import type { Context, Next } from "hono";
import { getMailboxByEmail } from "@/database/d1";

export async function checkMailboxLease(c: Context, next: Next) {
	const emailAddress = c.req.param("emailAddress");

	console.log('[Lease Check] URL:', c.req.url);
	console.log('[Lease Check] Param emailAddress:', emailAddress);

	if (!emailAddress) {
		return c.json({ error: "Email address is required" }, 400);
	}

	const mailbox = await getMailboxByEmail(c.env.D1, emailAddress);

	console.log('[Lease Check] Mailbox found:', !!mailbox);

	// Если ящик арендован — блокируем доступ через API
	if (mailbox) {
		return c.json(
			{ error: "Mailbox is leased and accessible only via Telegram @TempMail_on11_bot" },
			403,
		);
	}

	await next();
}
