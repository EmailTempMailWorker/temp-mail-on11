import { createId } from "@paralleldrive/cuid2";
import PostalMime, { type Email as PostalMimeEmail } from "postal-mime";
import { ATTACHMENT_LIMITS } from "@/config/constants";
import * as db from "@/database/d1";
import { getMailboxByEmail } from "@/database/d1";
// import * as r2 from "@/database/r2";
import { emailSchema } from "@/schemas/emails";
import type { Email } from "@/types/email";
import type { CloudflareBindings } from "@/types/env";
import { now } from "@/utils/helpers";
import { processEmailContent } from "@/utils/mail";
import { PerformanceTimer } from "@/utils/performance";
import { sendMessage } from "@/utils/telegram";

// === Типы ===
interface EmailAttachment {
	filename: string | null;
	mimeType?: string;
	content?: string | ArrayBuffer;
}

// === Валидация вложений ===
function validateAttachments(attachments: EmailAttachment[], emailId: string): EmailAttachment[] {
	const validAttachments: EmailAttachment[] = [];
	let totalAttachmentSize = 0;

	for (const attachment of attachments) {
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

// === Основной хендлер ===
export async function handleEmail(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	try {
		const timer = new PerformanceTimer("email-processing");
		const emailId = createId();

		// Парсим письмо
		const parsedEmail: PostalMimeEmail = await PostalMime.parse(message.raw);

		// Обрабатываем контент
		const { htmlContent, textContent } = processEmailContent(
			parsedEmail.html ?? null,
			parsedEmail.text ?? null,
		);

		// Валидируем вложения
		const attachments = parsedEmail.attachments || [];
		const validAttachments = validateAttachments(attachments, emailId);

		// === Пересылка в Telegram (в фоне) ===
		ctx.waitUntil(
			forwardEmailToTelegram(
				message,
				parsedEmail,
				validAttachments,
				env,
				ctx,
				env.TELEGRAM_CHAT_ID,
			),
		);

		const mailbox = await getMailboxByEmail(env.D1, message.to);

		if (mailbox) {
			const userChatId = String(mailbox.user_id);
			// === Отправляем пользователю (user_id = chat_id) ===
			ctx.waitUntil(
				forwardEmailToTelegram(
					message,
					parsedEmail,
					validAttachments,
					env,
					ctx,
					userChatId, // <-- вот и всё!
				),
			);
		}

		// === Сохраняем письмо в БД ===
		const emailData = emailSchema.parse({
			id: emailId,
			from_address: message.from,
			to_address: message.to,
			subject: parsedEmail.subject || null,
			received_at: now(),
			html_content: htmlContent,
			text_content: textContent,
			has_attachments: validAttachments.length > 0,
			attachment_count: validAttachments.length,
		});

		const { success, error } = await db.insertEmail(env.D1, emailData);
		if (!success) {
			throw new Error(`Failed to insert email: ${error}`);
		}

		// === Вложения в R2 (отключено) ===
		if (validAttachments.length > 0) {
			console.log("R2 upload disabled. ctx.waitUntil(processAttachments(...))");
		}

		timer.end();
	} catch (error) {
		console.error("Failed to process email:", error);
		throw error;
	}
}

// // === Обработка одного вложения ===
// async function _processSingleAttachment(
// 	env: CloudflareBindings,
// 	emailId: string,
// 	attachment: EmailAttachment,
// ): Promise<void> {
// 	if (!attachment.filename) {
// 		console.warn(`Skipping attachment without filename in email ${emailId}`);
// 		return;
// 	}

// 	const attachmentId = createId();

// 	let content: ArrayBuffer;
// 	let attachmentSize: number;

// 	if (attachment.content instanceof ArrayBuffer) {
// 		content = attachment.content;
// 		attachmentSize = content.byteLength;
// 	} else {
// 		const encodedContent = new TextEncoder().encode(attachment.content || "");
// 		content = encodedContent.buffer as ArrayBuffer;
// 		attachmentSize = encodedContent.byteLength;
// 	}

// 	const r2Key = r2.generateR2Key(emailId, attachmentId, attachment.filename);

// 	const attachmentData = {
// 		id: attachmentId,
// 		email_id: emailId,
// 		filename: attachment.filename,
// 		content_type: attachment.mimeType || "application/octet-stream",
// 		size: attachmentSize,
// 		r2_key: r2Key,
// 		created_at: now(),
// 	};

// 	const { success: dbSuccess, error: dbError } = await db.insertAttachment(env.D1, attachmentData);
// 	if (!dbSuccess) {
// 		console.error(`Failed to store attachment metadata for ${attachment.filename}:`, dbError);
// 	}
// }

// === Форматирование размера ===
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// === Отправка в Telegram ===
async function forwardEmailToTelegram(
	message: ForwardableEmailMessage,
	parsedEmail: PostalMimeEmail,
	validAttachments: EmailAttachment[],
	env: CloudflareBindings,
	ctx: ExecutionContext,
	chatId: string,
) {
	if (!env.TELEGRAM_LOG_ENABLE || !env.TELEGRAM_BOT_TOKEN || !chatId) {
		console.warn("[Telegram] Logging disabled or missing config");
		return;
	}

	const subject = parsedEmail.subject || "_без темы_";
	const from = message.from;
	const to = message.to;
	const date = new Date().toLocaleString("ru-RU");

	const bodyText =
		parsedEmail.text?.trim() || parsedEmail.html?.replace(/<[^>]*>/g, "").trim() || "_пустое тело_";

	const text = `
<b>Письмо на ${to}</b>

<b>От:</b> ${from}
<b>Тема:</b> ${subject}
<b>Дата:</b> ${date}

<b>Текст:</b>

${bodyText}
`.trim();

	ctx.waitUntil(sendMessage(text, env, chatId));

	// === Отправка HTML-версии письма как файла ===
	if (parsedEmail.html) {
		ctx.waitUntil(sendEmailAsHtmlFile(chatId, subject, from, date, parsedEmail.html, env, ctx));
	}

	// === Отправка вложений ===
	for (const att of validAttachments) {
		if (!att.filename || !att.content) continue;

		const filename = att.filename;
		const contentType = att.mimeType || "application/octet-stream";
		const size =
			att.content instanceof ArrayBuffer
				? att.content.byteLength
				: new TextEncoder().encode(att.content).byteLength;

		const form = new FormData();
		form.append("chat_id", chatId);

		let blob: Blob;
		if (att.content instanceof ArrayBuffer) {
			blob = new Blob([att.content], { type: contentType });
		} else {
			blob = new Blob([att.content], { type: contentType });
		}

		form.append("document", blob, filename);
		form.append("parse_mode", "HTML");
		form.append(
			"caption",
			`<b>Вложение:</b> \`${filename}\`\n<b>Тип:</b> ${contentType}\n<b>Размер:</b> ${formatBytes(size)}`,
		);

		ctx.waitUntil(
			fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
				method: "POST",
				body: form,
			})
				.then(async (res) => {
					if (!res.ok) {
						const text = await res.text();
						console.error("Telegram sendDocumentEmailAttachment error:", res.status, text);
					}
					// Просто читаем, чтобы освободить соединение
					await res.text();
				})
				.catch((err) => console.error("Telegram sendDocument failed:", err)),
		);
	}
}

// === Отправка письма как HTML-файла в Telegram ===
async function sendEmailAsHtmlFile(
	chatId: string,
	subject: string,
	from: string,
	date: string,
	html: string,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	if (!env.TELEGRAM_BOT_TOKEN) return;

	const safeSubject = (subject || "email").slice(0, 60).trim();
	const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${safeSubject}</title>
    <style>
        body { font-family: system-ui, sans-serif; line-height: 1.5; padding: 20px; background: #fafafa; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    ${html}
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
    <small>
        От: ${from}<br>
        Тема: ${safeSubject}<br>
        Получено: ${date}
    </small>
</body>
</html>`;

	const blob = new Blob([fullHtml], { type: "text/html" });

	const form = new FormData();
	form.append("chat_id", chatId);
	form.append("document", blob, `${safeSubject}.html`);
	form.append("caption", `**Письмо как HTML**\nОт: ${from}\nТема: ${safeSubject}`);

	ctx.waitUntil(
		fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
			method: "POST",
			body: form,
		})
			.then(async (res) => {
				if (!res.ok) {
					const text = await res.text();
					console.error("Telegram sendDocumentHTML error:", res.status, text);
				}
				// Просто читаем, чтобы освободить соединение
				await res.text();
			})
			.catch((err) => console.error("Failed to send HTML email:", err)),
	);
}

export async function getMessages(
	env: CloudflareBindings,
	domain: string,
	login: string,
): Promise<Email[]> {
	const email = `${login}@${domain}`;

	try {
		const { results } = await env.D1.prepare(
			`SELECT 
           id, from_address, to_address, subject, 
           received_at, html_content, text_content, 
           has_attachments, attachment_count
         FROM emails 
         WHERE to_address = ? 
         ORDER BY received_at DESC 
         LIMIT 10`,
		)
			.bind(email)
			.all<Email>();

		return results || [];
	} catch (error) {
		console.error("Failed to fetch emails:", error);
		return [];
	}
}
