import type { CloudflareBindings } from "@/types/env";
import type { TelegramUpdate } from "@/types/telegram";
import { logInfo } from "@/utils/logger";

export async function sendMessage(
	text: string,
	env: CloudflareBindings,
	chatId?: string | number, // <-- добавили параметр опционально
) {
	if (!env.TELEGRAM_BOT_TOKEN) {
		logInfo("Telegram bot token not set");
		return;
	}

	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

	await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			parse_mode: "HTML",
		}),
	}).catch((err) => console.error("Telegram send error:", err));
}

export async function handleTelegramUpdate(
	body: TelegramUpdate,
	env: CloudflareBindings,
): Promise<Response> {
	const message = body.message;
	if (!message?.text) return new Response("OK", { status: 200 });

	const chatId = message.chat.id.toString();
	const text = message.text.trim();

	// === Если НЕ админ ===
	if (chatId !== env.TELEGRAM_CHAT_ID) {
		await sendMessage("Доступ пока закрыт. Бот в разработке.", env, chatId);
		return new Response("OK", { status: 200 });
	}

	// === Если админ ===
	if (text === "/start") {
		await sendMessage(
			`<b>Привет, админ!</b>\n\n` +
				`Этот бот получает всю почту с временных ящиков.\n\n` +
				`Новые письма приходят сюда автоматически.\n\n` +
				`<i>Скоро будет /refresh</i>`,
			env,
			chatId,
		);
	}

	return new Response("OK", { status: 200 });
}
