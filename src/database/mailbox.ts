import type { CloudflareBindings } from "@/types/env";

const RENTAL_DAYS = 1;
const ON_DOMAIN = "on11.ru";

export interface Mailbox {
	email: string;
	user_id: string;
	created_at: string;
	expires_at: string;
	status: "active" | "expired";
}

export class MailboxDB {
	private db: D1Database;

	constructor(env: CloudflareBindings) {
		this.db = env.D1;
	}

	private generateEmail(): string {
		const prefix = crypto.randomUUID().slice(0, 10);
		return `${prefix}@${ON_DOMAIN}`;
	}

	async ensureUser(userId: string, maxBoxes = 3): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO users (user_id, max_boxes) VALUES (?, ?) 
         ON CONFLICT(user_id) DO UPDATE SET max_boxes = excluded.max_boxes`,
			)
			.bind(userId, maxBoxes)
			.run();
	}

	async getActiveCount(userId: string): Promise<number> {
		const result = await this.db
			.prepare(`SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ? AND status = 'active'`)
			.bind(userId)
			.first<{ count: number }>();
		return result?.count || 0;
	}

	async create(userId: string): Promise<{ email: string; expiresAt: string }> {
		await this.ensureUser(userId);

		const count = await this.getActiveCount(userId);
		const max = await this.db
			.prepare(`SELECT max_boxes FROM users WHERE user_id = ?`)
			.bind(userId)
			.first<number>("max_boxes");

		if (count >= (max || 3)) {
			throw new Error("Лимит ящиков исчерпан");
		}

		let email: string | undefined;
		let inserted = false;

		while (!inserted) {
			email = this.generateEmail();
			try {
				const expiresAt = new Date(Date.now() + RENTAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
				await this.db
					.prepare(
						`INSERT INTO mailboxes (email, user_id, expires_at, status) VALUES (?, ?, ?, 'active')`,
					)
					.bind(email, userId, expiresAt)
					.run();
				inserted = true;
				// email гарантированно определён после успешного INSERT
				return { email, expiresAt };
			} catch (e) {
				const err = e as Error;
				if (!err.message.includes("UNIQUE")) throw err;
			}
		}

		throw new Error("Не удалось создать ящик");
	}

	async exists(email: string): Promise<boolean> {
		const result = await this.db
			.prepare(`SELECT 1 FROM mailboxes WHERE email = ? LIMIT 1`)
			.bind(email)
			.first();
		return !!result;
	}

	async createCustom(userId: string, email: string): Promise<{ expiresAt: string }> {
		await this.ensureUser(userId);

		const count = await this.getActiveCount(userId);
		const max = await this.db
			.prepare(`SELECT max_boxes FROM users WHERE user_id = ?`)
			.bind(userId)
			.first<number>("max_boxes");

		if (count >= (max || 3)) {
			throw new Error("Лимит ящиков исчерпан");
		}

		const exists = await this.exists(email);
		if (exists) {
			throw new Error("Ящик уже существует");
		}

		const expiresAt = new Date(Date.now() + RENTAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

		try {
			await this.db
				.prepare(
					`INSERT INTO mailboxes (email, user_id, expires_at, status) VALUES (?, ?, ?, 'active')`,
				)
				.bind(email, userId, expiresAt)
				.run();
		} catch (e) {
			const err = e as Error;
			if (err.message.includes("UNIQUE")) {
				throw new Error("Ящик уже существует");
			}
			throw err;
		}

		return { expiresAt };
	}

	async list(userId: string): Promise<{ own: Mailbox[]; available: Mailbox[] }> {
		await this.expireAll();

		const own = await this.db
			.prepare(
				`SELECT email, created_at, expires_at, status FROM mailboxes WHERE user_id = ? AND status = 'active'`,
			)
			.bind(userId)
			.all<Mailbox>();

		const available = await this.db
			.prepare(
				`SELECT email, created_at, expires_at, status FROM mailboxes WHERE user_id != ? AND status = 'expired'`,
			)
			.bind(userId)
			.all<Mailbox>();

		return { own: own.results || [], available: available.results || [] };
	}

	async select(userId: string, email: string): Promise<void> {
		await this.expireAll();

		const exists = await this.db
			.prepare(`SELECT id, status FROM mailboxes WHERE email = ?`)
			.bind(email)
			.first<{ id: number; status: string }>();

		if (!exists || exists.status !== "expired") {
			throw new Error("Ящик недоступен");
		}

		const expiresAt = new Date(Date.now() + RENTAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
		await this.db
			.prepare(`UPDATE mailboxes SET user_id = ?, status = 'active', expires_at = ? WHERE id = ?`)
			.bind(userId, expiresAt, exists.id)
			.run();
	}

	private async expireAll(): Promise<void> {
		const now = new Date().toISOString();
		await this.db
			.prepare(`UPDATE mailboxes SET status = 'expired' WHERE expires_at < ? AND status = 'active'`)
			.bind(now)
			.run();
	}
}
