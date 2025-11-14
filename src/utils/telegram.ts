import type { CloudflareBindings } from "@/types/env";

import { logInfo } from "@/utils/logger";

export async function sendMessage(
	text: string,
	env: CloudflareBindings,
	chatId?: string | number,
): Promise<void> {
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
	})
		.then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				console.error("Telegram sendMessage error:", res.status, text);
			}
			// Просто читаем, чтобы освободить соединение
			await res.text();
		})
		.catch((err) => console.error("Telegram send error:", err));
}
