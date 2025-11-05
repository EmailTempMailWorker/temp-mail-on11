import type { TelegramUpdate } from "@/types/telegram";
import { logError, logInfo } from "@/utils/logger";

/**
 * Send message to Telegram
 */
export async function sendMessage(
	text: string,
	env: CloudflareBindings,
	parse_mode: "MarkdownV2" | "HTML" | "Markdown" = "HTML",
) {
	if (!env.TELEGRAM_LOG_ENABLE || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		logInfo("Telegram logging is disabled.");
		return;
	}

	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: env.TELEGRAM_CHAT_ID,
				text,
				parse_mode,
				disable_web_page_preview: true,
			}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			console.error("[Telegram] Failed to send message:", error);
			logError("Telegram sendMessage failed", error as Error);
		}
	} catch (error) {
		console.error("[Telegram] Exception:", error);
		logError("Failed to send Telegram message", error as Error);
	}
}

/**
 * Escape MarkdownV2
 */
function escapeMarkdownV2(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

/**
 * Handle incoming Telegram update (from webhook)
 */
export async function handleTelegramUpdate(
	body: TelegramUpdate | Record<string, unknown>,
	env: CloudflareBindings,
): Promise<Response> {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		return new Response("Telegram not configured", { status: 500 });
	}

	try {
		const update = "message" in body ? (body as TelegramUpdate) : null;
		const message = update?.message;

		if (!message?.text) {
			return new Response("OK", { status: 200 });
		}

		const chatId = message.chat.id.toString();
		const text = message.text.trim();

		// Проверяем, что это админ
		if (chatId !== env.TELEGRAM_CHAT_ID) {
			await sendMessage("Доступ запрещён.", env);
			return new Response("OK", { status: 200 });
		}

		// Обработка команды /start
		if (text === "/start") {
			const welcome = escapeMarkdownV2(`
*Привет, админ!*

Этот бот получает всю почту с временных ящиков.

Новые письма будут приходить сюда автоматически.
      `);

			await sendMessage(welcome, env, "MarkdownV2");
			return new Response("OK", { status: 200 });
		}

		await sendMessage(`Неизвестная команда: \`${escapeMarkdownV2(text)}\``, env, "MarkdownV2");

		return new Response("OK", { status: 200 });
	} catch (error) {
		logError("Telegram update handler error", error as Error);
		return new Response("Error", { status: 500 });
	}
}

/**
 * Register webhook
 */
export async function registerWebhook(
	env: CloudflareBindings,
	workerUrl: string,
): Promise<boolean> {
	if (!env.TELEGRAM_BOT_TOKEN) return false;

	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
	const webhookUrl = `${workerUrl}/api/telegram`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: webhookUrl }),
		});

		//const result: any = await response.json();
		interface SetWebhookResponse {
			ok: boolean;
			result?: {
				url: string;
				has_custom_certificate: boolean;
				pending_update_count: number;
			};
			description?: string;
		}

		const result = (await response.json()) as SetWebhookResponse;
		if (result.ok) {
			logInfo(`Webhook registered: ${webhookUrl}`);
			return true;
		} else {
			logError("Failed to register webhook", result);
			return false;
		}
	} catch (error) {
		logError("Webhook registration error", error as Error);
		return false;
	}
}
