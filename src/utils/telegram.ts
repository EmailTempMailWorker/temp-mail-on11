import { logError, logInfo } from "@/utils/logger";

/**
 * Send message to Telegram
 */
export async function sendMessage(text: string, env: CloudflareBindings) {
	if (!env.TELEGRAM_LOG_ENABLE || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		// console.warn("[Telegram] Logging disabled or missing config");
		logInfo("Telegram logging is disabled.");
		return;
	}

	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

	// try {
	// 	await fetch(url, {
	// 		method: "POST",
	// 		headers: {
	// 			"Content-Type": "application/json",
	// 		},
	// 		body: JSON.stringify({
	// 			chat_id: Number(env.TELEGRAM_CHAT_ID),
	// 			text,
	// 			parse_mode: "Markdown",
	// 		}),
	// 	});
	// } catch (error) {
	// 	logError("Failed to send Telegram message", error as Error);
	// }
	// console.log("[Telegram] Sending message:", text.substring(0, 100) + "...");

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: Number(env.TELEGRAM_CHAT_ID),
				text,
				parse_mode: "Markdown",
			}),
		});

		const result = await response.json();
		// console.log("[Telegram] API response:", result);

		if (!response.ok) {
			console.error("[Telegram] Failed:", result);
		}
	} catch (error) {
		console.error("[Telegram] Exception:", error);
	}
}
