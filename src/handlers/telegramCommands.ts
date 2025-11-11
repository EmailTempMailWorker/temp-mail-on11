import { MailboxDB } from "@/database/mailbox";
import { getMessages } from "@/handlers/emailHandler";
import type { Email } from "@/types/email";
import type { CloudflareBindings } from "@/types/env";
import { sendMessage } from "@/utils/telegram";
import { validateEmailLogin } from "@/utils/validateEmailLogin";

// === Обработчики команд ===
async function handleStart(env: CloudflareBindings, chatId: string): Promise<void> {
	await sendMessage(
		`<b>Привет!</b>\n\n` +
			`Временные почтовые ящики.\n\n` +
			`Команды:\n` +
			`/create — создать новый ящик\n` +
			`/list — мои ящики\n` +
			`/delete &lt;email&gt; — удалить ящик\n`, //+
		//`/emails &lt;email&gt; — письма`,
		env,
		chatId,
	);
}

async function handleCreate(env: CloudflareBindings, chatId: string): Promise<void> {
	await sendMessage(
		`<b>Создание ящика</b>\n\n` +
			`Выберите способ:\n` +
			`/auto — сгенерировать автоматически\n` +
			`/custom &lt;имя&gt; — указать свой вариант`,
		env,
		chatId,
	);
}

async function handleAutoCreate(
	db: MailboxDB,
	userId: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	const { email, expiresAt } = await db.create(userId);
	await sendMessage(
		`<b>Автоматически создан ящик:</b>\n` +
			`Email: <code>${email}</code>\n` +
			`Истекает: ${expiresAt}` +
			`Истекает: ${new Date(expiresAt).toLocaleString()}`,//\n\n` +
			//`Письма: /emails ${email}`,
		env,
		chatId,
	);
}

async function handleCustomCreate(
	db: MailboxDB,
	userId: string,
	customLogin: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	const resultEmailLogin = validateEmailLogin(customLogin);
	if (!resultEmailLogin.valid) {
		await sendMessage(`Ошибка: ${resultEmailLogin.error}`, env, chatId);
		return;
	}

	const domain = "on11.ru";
	const email = `${customLogin.toLowerCase()}@${domain}`;

	const exists = await db.exists(email);
	if (exists) {
		await sendMessage(
			`❌ Ящик <code>${email}</code> уже занят. Попробуйте другое имя.`,
			env,
			chatId,
		);
		return;
	}

	const { expiresAt } = await db.createCustom(userId, email);
	await sendMessage(
		`<b>Ящик создан!</b>\n` +
			`Email: <code>${email}</code>\n` +
			`Истекает: ${new Date(expiresAt).toLocaleString()}`, //\n\n` +
		//`Письма: /emails ${email}`,
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
	const { own } = await db.list(userId);
	//const { own, available } = await db.list(userId);

	let text = "<b>Ваши ящики:</b>\n";
	if (own.length === 0) text += "—\n";
	// else for (const m of own) text += `• <code>${m.email}</code>\n`;
	else
		for (const m of own) {
			text +=
				`• <b><code>${m.email}</code></b>\n` +
				`  до ${m.expires_at}\n` +
				`  до ${new Date(m.expires_at).toLocaleString()}\n` +
				`  /delete ${m.email}\n`;
		}

	// text += "\n<b>Доступные для аренды:</b>\n";
	// if (available.length === 0) text += "—\n";
	// else for (const m of available) text += `• /select ${m.email}\n`;

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

async function handleDelete(
	db: MailboxDB,
	userId: string,
	email: string,
	env: CloudflareBindings,
	chatId: string,
): Promise<void> {
	if (!email.includes("@") || !email.endsWith("@on11.ru")) {
		await sendMessage("Использование: /delete yourname@on11.ru", env, chatId);
		return;
	}

	const normalized = email.toLowerCase().trim();

	// Используем публичный метод
	const status = await db.getMailboxStatus(normalized, userId);

	if (status !== "active") {
		await sendMessage(`Ящик <code>${normalized}</code> не найден или не ваш.`, env, chatId);
		return;
	}

	await db.deleteMailbox(userId, normalized);
	await sendMessage(`Ящик <code>${normalized}</code> удалён.`, env, chatId);
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
			case "/start":
				await handleStart(env, chatId);
				break;

			case "/create":
				await handleCreate(env, chatId);
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

			case "/auto":
				await handleAutoCreate(db, userId, env, chatId);
				break;

			case "/custom":
				if (!args) {
					await sendMessage("Использование: /custom &lt;имя&gt;", env, chatId);
					break;
				}
				await handleCustomCreate(db, userId, args, env, chatId);
				break;

			case "/delete":
				await handleDelete(db, userId, args, env, chatId);
				break;

			default:
				await sendMessage("Неизвестная команда. Используй /start", env, chatId);
		}
	} catch (e) {
		const err = e as Error;
		await sendMessage(`Ошибка: ${err.message}`, env, chatId);
	}
}
