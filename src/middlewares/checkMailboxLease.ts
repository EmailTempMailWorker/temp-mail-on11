import type { Context, Next } from "hono";
import { getMailboxByEmail } from "@/database/d1";

export async function checkMailboxLease(c: Context, next: Next) {
	const match = c.req.path.match(/^\/emails\/([^/]+)/);
	if (!match) return await next();

	const emailAddress = decodeURIComponent(match[1]);

	if (!emailAddress.includes("@")) {
		return c.json({ error: "Invalid email" }, 400);
	}

	const mailbox = await getMailboxByEmail(c.env.D1, emailAddress);
	if (mailbox) {
		return c.json(
			{ error: "Mailbox is leased and accessible only via Telegram @TempMail_on11_bot" },
			403,
		);
	}

	await next();
}
