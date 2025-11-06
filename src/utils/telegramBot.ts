import { handleUserCommand } from "@/handlers/telegramCommands";
import type { CloudflareBindings } from "@/types/env";
import type { TelegramUpdate } from "@/types/telegram";
import { sendMessage } from "./telegram";

export async function handleTelegramBotUpdate(
	body: TelegramUpdate,
	env: CloudflareBindings,
): Promise<Response> {
	const message = body.message;
	if (!message?.text) return new Response("OK", { status: 200 });

	const chatId = message.chat.id.toString();
	const text = message.text.trim();

	//     // === Обычный пользователь ===
	//   if (chatId !== env.TELEGRAM_CHAT_ID) {
	//     const command = text.split(" ")[0];
	//     const args = text.slice(command.length).trim();

	//     switch (command) {
	//       case "/start":
	//         await sendTelegramMessage(
	//           `<b>Привет!</b>\n\n` +
	//             `Временные почтовые ящики.\n\n` +
	//             `Команды:\n` +
	//             `/create — создать новый ящик\n` +
	//             `/list — мои ящики\n` +
	//             `/select <email> — арендовать ящик\n` +
	//             `/emails <email> — письма`,
	//           env,
	//           chatId,
	//         );
	//         break;

	//       default:
	//         await sendTelegramMessage("Неизвестная команда. Используй /start", env, chatId);
	//     }
	//     return new Response("OK", { status: 200 });
	//   }

	if (chatId !== env.TELEGRAM_CHAT_ID) {
		const [cmd, ...rest] = text.split(" ");
		const args = rest.join(" ");
		await handleUserCommand(cmd, args, chatId, env);
		return new Response("OK", { status: 200 });
	}

	// === Админ ===
	if (text === "/start") {
		await sendMessage(
			`<b>Админ-панель</b>\n\n` + `Все письма приходят сюда.\n` + `<i>Скоро: /refresh, /stats</i>`,
			env,
			chatId,
		);
	}

	return new Response("OK", { status: 200 });
}
