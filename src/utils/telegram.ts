import { logInfo } from "@/utils/logger";

export async function sendMessage(text: string, env: CloudflareBindings) {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		logInfo("Telegram logging is disabled.");
		return;
	}

	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
	await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: env.TELEGRAM_CHAT_ID,
			text,
			parse_mode: "HTML",
		}),
	});
}

export async function handleTelegramUpdate(body: any, env: CloudflareBindings): Promise<Response> {
	const message = body.message;
	if (!message?.text) return new Response("OK", { status: 200 });

	const chatId = message.chat.id.toString();
	if (chatId !== env.TELEGRAM_CHAT_ID) {
		await sendMessage("Доступ пока закрыт. Бот в разработке.", env);
		return new Response("OK", { status: 200 });
	}

	if (message.text === "/start") {
		await sendMessage(
			`<b>Привет!</b>\n\nПочта приходит сюда автоматически.\n\n/start — это всё, что пока есть`,
			env,
		);
	}

	return new Response("OK", { status: 200 });
}
