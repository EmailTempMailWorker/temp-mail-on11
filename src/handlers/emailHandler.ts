import { createId } from "@paralleldrive/cuid2";
import PostalMime from "postal-mime";
import { ATTACHMENT_LIMITS } from "@/config/constants";
import * as db from "@/database/d1";
import * as r2 from "@/database/r2";
import { emailSchema } from "@/schemas/emails";
import type { ParsedEmail } from "@/types/email";
import { now } from "@/utils/helpers";
import { processEmailContent } from "@/utils/mail";
import { PerformanceTimer } from "@/utils/performance";
import { sendMessage } from "@/utils/telegram";

// Type for PostalMime attachments
interface EmailAttachment {
	filename: string | null;
	mimeType?: string;
	content?: string | ArrayBuffer;
}

/**
 * Validate and filter email attachments
 */
function validateAttachments(attachments: EmailAttachment[], emailId: string): EmailAttachment[] {
	const validAttachments = [];
	let totalAttachmentSize = 0;

	for (const attachment of attachments) {
		// Skip attachments without filename
		if (!attachment.filename) {
			console.warn(`Email ${emailId}: Attachment without filename, skipping`);
			continue;
		}

		if (validAttachments.length >= ATTACHMENT_LIMITS.MAX_COUNT_PER_EMAIL) {
			console.warn(`Email ${emailId}: Too many attachments, skipping remaining`);
			break;
		}

		const attachmentSize =
			attachment.content instanceof ArrayBuffer
				? attachment.content.byteLength
				: new TextEncoder().encode(attachment.content || "").byteLength;

		// Check file type
		const contentType = attachment.mimeType || "application/octet-stream";
		if (
			!ATTACHMENT_LIMITS.ALLOWED_TYPES.includes(
				contentType as (typeof ATTACHMENT_LIMITS.ALLOWED_TYPES)[number],
			)
		) {
			console.warn(
				`Email ${emailId}: Attachment ${attachment.filename} has unsupported type (${contentType}), skipping`,
			);
			continue;
		}

		if (attachmentSize > ATTACHMENT_LIMITS.MAX_SIZE) {
			console.warn(
				`Email ${emailId}: Attachment ${attachment.filename} too large (${attachmentSize} bytes), skipping`,
			);
			continue;
		}

		totalAttachmentSize += attachmentSize;
		if (totalAttachmentSize > ATTACHMENT_LIMITS.MAX_SIZE * ATTACHMENT_LIMITS.MAX_COUNT_PER_EMAIL) {
			console.warn(
				`Email ${emailId}: Total attachment size too large, skipping remaining attachments`,
			);
			break;
		}

		validAttachments.push(attachment);
	}

	return validAttachments;
}

/**
 * Cloudflare email router handler - optimized version
 */
export async function handleEmail(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	try {
		const timer = new PerformanceTimer("email-processing");
		const emailId = createId();
		const email = await PostalMime.parse(message.raw);

		// Process email content
		const { htmlContent, textContent } = processEmailContent(
			email.html ?? null,
			email.text ?? null,
		);

		// Process attachments
		const attachments = email.attachments || [];
		const validAttachments = validateAttachments(attachments, emailId);
		// Пересылаем письмо в Telegram сразу (без ожидания R2)
		ctx.waitUntil(
			forwardEmailToTelegram(message, email as ParsedEmail, validAttachments, env, ctx),
		);

		const emailData = emailSchema.parse({
			id: emailId,
			from_address: message.from,
			to_address: message.to,
			subject: email.subject || null,
			received_at: now(),
			html_content: htmlContent,
			text_content: textContent,
			has_attachments: validAttachments.length > 0,
			attachment_count: validAttachments.length,
		});

		// Insert email
		const { success, error } = await db.insertEmail(env.D1, emailData);

		if (!success) {
			throw new Error(`Failed to insert email: ${error}`);
		}

		// Process and store attachments
		if (validAttachments.length > 0) {
			// ctx.waitUntil(processAttachments(env, emailId, validAttachments as EmailAttachment[]));
			// Пересылаем письмо в Telegram сразу (без ожидания R2)
			// ctx.waitUntil(forwardEmailToTelegram(message, email, validAttachments, env, ctx));
			// ctx.waitUntil(processAttachments(env, emailId, validAttachments as EmailAttachment[]));
			console.log("Есть проблемы с R2. Отключено ctx.waitUntil(processAttachments(env, ...))");
		}

		timer.end(); // Log processing time
	} catch (error) {
		console.error("Failed to process email:", error);
		throw error;
	}
}

/**
 * Process a single attachment
 */
async function processSingleAttachment(
	env: CloudflareBindings,
	emailId: string,
	attachment: EmailAttachment,
): Promise<void> {
	// Skip attachments without filename
	if (!attachment.filename) {
		console.warn(`Skipping attachment without filename in email ${emailId}`);
		return;
	}

	const attachmentId = createId();

	let content: ArrayBuffer;
	let attachmentSize: number;

	if (attachment.content instanceof ArrayBuffer) {
		content = attachment.content;
		attachmentSize = content.byteLength;
	} else {
		const encodedContent = new TextEncoder().encode(attachment.content || "");
		content = encodedContent.buffer as ArrayBuffer;
		attachmentSize = encodedContent.byteLength;
	}

	// Generate R2 key
	const r2Key = r2.generateR2Key(emailId, attachmentId, attachment.filename);

	// Store in R2
	const { success: r2Success, error: r2Error } = await r2.storeAttachment(
		env.R2,
		r2Key,
		content,
		attachment.mimeType || "application/octet-stream",
		attachment.filename,
	);

	if (!r2Success) {
		console.error(`Failed to store attachment ${attachment.filename}:`, r2Error);
		return;
	}

	// Store metadata in database
	const attachmentData = {
		id: attachmentId,
		email_id: emailId,
		filename: attachment.filename,
		content_type: attachment.mimeType || "application/octet-stream",
		size: attachmentSize,
		r2_key: r2Key,
		created_at: now(),
	};

	const { success: dbSuccess, error: dbError } = await db.insertAttachment(env.D1, attachmentData);
	if (!dbSuccess) {
		console.error(`Failed to store attachment metadata for ${attachment.filename}:`, dbError);
		// Try to clean up R2 object
		await r2.deleteAttachment(env.R2, r2Key);
	}
}

/**
 * Process and store email attachments
 */
async function _processAttachments(
	env: CloudflareBindings,
	emailId: string,
	attachments: EmailAttachment[],
) {
	try {
		for (const attachment of attachments) {
			await processSingleAttachment(env, emailId, attachment);
		}
	} catch (error) {
		console.error("Failed to process attachments:", error);
	}
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Forward full email + attachments to Telegram immediately
 */
async function forwardEmailToTelegram(
	message: ForwardableEmailMessage,
	email: ParsedEmail,
	validAttachments: EmailAttachment[],
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	// console.log("[DEBUG] Telegram forwarding triggered for:", message.from, "->", message.to);
	if (!env.TELEGRAM_LOG_ENABLE || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		console.warn("[Telegram239] Logging disabled or missing config");
		return;
	}

	const subject = email.subject || "_без темы_";
	const from = message.from;
	const to = message.to;
	const date = new Date().toLocaleString("ru-RU");

	// Основное сообщение
	const text = `
*Новое письмо*

*От:* \`${from}\`
*Кому:* \`${to}\`
*Тема:* ${subject}
*Дата:* ${date}

*Текст:*
\`\`\`
${email.text?.trim() || email.html?.replace(/<[^>]*>/g, "").trim() || "_пустое тело_"}
\`\`\`
`.trim();

	ctx.waitUntil(sendMessage(text, env));

	// Пересылка вложений сразу (без R2)
	for (const att of validAttachments) {
		if (!att.filename || !att.content) continue;

		const filename = att.filename;
		const contentType = att.mimeType || "application/octet-stream";
		const size =
			att.content instanceof ArrayBuffer
				? att.content.byteLength
				: new TextEncoder().encode(att.content).byteLength;

		// Формируем FormData для sendDocument
		const form = new FormData();
		form.append("chat_id", env.TELEGRAM_CHAT_ID);

		// Создаём Blob из ArrayBuffer или строки
		let blob: Blob;
		if (att.content instanceof ArrayBuffer) {
			blob = new Blob([att.content], { type: contentType });
		} else {
			blob = new Blob([att.content], { type: contentType });
		}

		form.append("document", blob, filename);
		form.append(
			"caption",
			`*Вложение:* \`${filename}\`\n*Тип:* ${contentType}\n*Размер:* ${formatBytes(size)}`,
		);

		// Отправляем в фоне
		ctx.waitUntil(
			fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
				method: "POST",
				body: form,
			}).catch((err) => console.error("Telegram sendDocument failed:", err)),
		);
	}
}
