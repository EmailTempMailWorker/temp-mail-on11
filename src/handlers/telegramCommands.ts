import { MailboxDB } from "@/database/mailbox";
import { getMessages } from "@/handlers/emailHandler";
import type { Email } from "@/types/email";
import type { CloudflareBindings } from "@/types/env";
import { sendMessage } from "@/utils/telegram";

// === Обработчики команд ===
async function handleCreate(
	db: MailboxDB,
	userId: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	const { email, expiresAt } = await db.create(userId);
	await sendMessage(
		`<b>Ящик создан!</b>\n\n` +
			`Email: <code>${email}</code>\n` +
			`Истекает: ${new Date(expiresAt).toLocaleString()}\n\n` +
			`Письма: /emails ${email}`,
		env,
		chatId,
	);
}

async function handleList(
	db: MailboxDB,
	userId: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	const { own, available } = await db.list(userId);

	let text = "<b>Ваши ящики:</b>\n";
	if (own.length === 0) text += "—\n";
	else for (const m of own) text += `• <code>${m.email}</code>\n`;

	text += "\n<b>Доступные для аренды:</b>\n";
	if (available.length === 0) text += "—\n";
	else for (const m of available) text += `• /select ${m.email}\n`;

	await sendMessage(text, env, chatId);
}

async function handleSelect(
	db: MailboxDB,
	userId: string,
	email: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	if (!email.includes("@")) {
		await sendMessage("Использование: /select email@temp-mail.on11", env, chatId);
		return;
	}
	await db.select(userId, email);
	await sendMessage(`Ящик <code>${email}</code> теперь ваш!`, env, chatId);
}

async function handleEmails(env: CloudflareBindings, args: string, chatId: string): Promise<void> {
	if (!args.includes("@")) {
		await sendMessage("Использование: /emails email@temp-mail.on11", env, chatId);
		return;
	}

	const [login, domain] = args.split("@");
	const messages: Email[] = await getMessages(env, domain, login);

	if (messages.length === 0) {
		await sendMessage(`Писем в <code>${args}</code> нет.`, env, chatId);
		return;
	}

	const msg = messages[0];
	await sendMessage(
		`<b>Последнее письмо:</b>\n\n` +
			`От: ${msg.from_address}\n` +
			`Тема: ${msg.subject ?? "_без темы_"}\n` +
			`Дата: ${new Date(msg.received_at * 1000).toLocaleString()}`,
		env,
		chatId,
	);
}

// === Основная функция ===
export async function handleUserCommand(
	command: string,
	args: string,
	chatId: string,
	env: CloudflareBindings,
): Promise<void> {
	const db = new MailboxDB(env);
	const userId = chatId;

	try {
		switch (command) {
			case "/create":
				await handleCreate(db, userId, env, chatId);
				break;

			case "/list":
				await handleList(db, userId, env, chatId);
				break;

			case "/select":
				await handleSelect(db, userId, args, env, chatId);
				break;

			case "/emails":
				await handleEmails(env, args, chatId);
				break;

			default:
				await sendMessage("Неизвестная команда. Используй /start", env, chatId);
		}
	} catch (e) {
		const err = e as Error;
		await sendMessage(`Ошибка: ${err.message}`, env, chatId);
	}
}
