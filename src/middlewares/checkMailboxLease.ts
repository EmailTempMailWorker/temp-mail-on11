import type { Context, Next } from "hono";
import { getMailboxByEmail } from "@/database/d1";
//import { createDatabaseService } from '@/database';

export async function checkMailboxLease(c: Context, next: Next) {
	const emailAddress = c.req.param("emailAddress");

	if (!emailAddress) {
		return c.json({ error: "Email address is required" }, 400);
	}

	//const dbService = createDatabaseService(c.env.D1);
	const mailbox = await getMailboxByEmail(c.env.D1, emailAddress);

	// Если ящик арендован — блокируем доступ через API
	if (mailbox) {
		return c.json(
			{ error: "Mailbox is leased and accessible only via Telegram @TempMail_on11_bot" },
			403,
		);
	}

	await next();
}
