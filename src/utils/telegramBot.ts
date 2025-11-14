import { MailboxDB } from "@/database/mailbox";
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

	if (chatId !== env.TELEGRAM_CHAT_ID) {
		const [cmd, ...rest] = text.split(" ");
		const args = rest.join(" ");
		await handleUserCommand(cmd, args, chatId, env);
		return new Response("OK", { status: 200 });
	}

	// === Админ ===
	if (text === "/start") {
		await sendMessage(
			`<b>Админ-панель</b>\n\n` +
				`Все письма приходят сюда.\n\n` +
				`<b>Управление ролями:</b>\n` +
				`/setrole &lt;userId&gt; &lt;regular|vip|admin&gt;\n` +
				`/getrole &lt;userId&gt;\n\n`,
			env,
			chatId,
		);
		return new Response("OK", { status: 200 });
	}

	// --- Команды управления ролями ---
	const db = new MailboxDB(env);

	if (text.startsWith("/setrole ")) {
		const parts = text.slice(9).trim().split(" ");
		if (parts.length !== 2 || !["regular", "vip", "admin"].includes(parts[1])) {
			await sendMessage(
				`<b>Ошибка:</b> Использование:\n` + `/setrole &lt;userId&gt; &lt;regular|vip|admin&gt;`,
				env,
				chatId,
			);
			return new Response("OK", { status: 200 });
		}

		const [targetUserId, role] = parts as [string, "regular" | "vip" | "admin"];

		try {
			await db.setUserRole(targetUserId, role);
			await sendMessage(
				`<b>Роль установлена!</b>\n` +
					`Пользователь: <code>${targetUserId}</code>\n` +
					`Роль: <code>${role}</code>`,
				env,
				chatId,
			);
		} catch (e) {
			await sendMessage(`Ошибка: ${(e as Error).message}`, env, chatId);
		}
		return new Response("OK", { status: 200 });
	}

	if (text.startsWith("/getrole ")) {
		const targetUserId = text.slice(9).trim();
		if (!targetUserId) {
			await sendMessage(`<b>Ошибка:</b> Укажите userId`, env, chatId);
			return new Response("OK", { status: 200 });
		}

		try {
			const role = await db.getUserRole(targetUserId);
			await sendMessage(
				`<b>Роль пользователя</b>\n<code>${targetUserId}</code> → <code>${role}</code>`,
				env,
				chatId,
			);
		} catch (e) {
			await sendMessage(`Ошибка: ${(e as Error).message}`, env, chatId);
		}
		return new Response("OK", { status: 200 });
	}

	// Если ни одна команда не подошла — просто OK
	return new Response("OK", { status: 200 });
}
