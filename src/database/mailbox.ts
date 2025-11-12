import type { CloudflareBindings } from "@/types/env";

const ON_DOMAIN = "on11.ru";

// Типы ролей и их настройки
interface RoleConfig {
	maxBoxes: number;
	rentalHours: number; // в часах
}

const ROLE_CONFIGS: Record<string, RoleConfig> = {
	regular: { maxBoxes: 3, rentalHours: 1 },
	vip: { maxBoxes: 10, rentalHours: 7 * 24 }, // неделя
	admin: { maxBoxes: 1000, rentalHours: 180 * 24 }, // полгода
};

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

	// Получение конфига роли (с дефолтом regular)
	private async getRoleConfig(userId: string): Promise<RoleConfig> {
		const roleResult = await this.db
			.prepare(`SELECT role FROM user_roles WHERE user_id = ?`)
			.bind(userId)
			.first<{ role: string }>();

		const role = roleResult?.role || "regular";
		return ROLE_CONFIGS[role] || ROLE_CONFIGS.regular;
	}

	// Синхронизация users.max_boxes с актуальной ролью
	private async syncUserLimits(userId: string): Promise<RoleConfig> {
		const config = await this.getRoleConfig(userId);

		await this.db
			.prepare(
				`INSERT INTO users (user_id, max_boxes) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET max_boxes = excluded.max_boxes`,
			)
			.bind(userId, config.maxBoxes)
			.run();

		return config;
	}

	async ensureUser(userId: string): Promise<RoleConfig> {
		await this.db
			.prepare(`INSERT INTO users (user_id, max_boxes) VALUES (?, 3) ON CONFLICT DO NOTHING`)
			.bind(userId)
			.run();

		await this.db
			.prepare(
				`INSERT INTO user_roles (user_id, role) VALUES (?, 'regular') ON CONFLICT DO NOTHING`,
			)
			.bind(userId)
			.run();

		return await this.syncUserLimits(userId);
	}

	async getActiveCount(userId: string): Promise<number> {
		const result = await this.db
			.prepare(`SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ? AND status = 'active'`)
			.bind(userId)
			.first<{ count: number }>();
		return result?.count || 0;
	}

	// Форматирование даты в МСК, 24-часовой формат
	private formatMoscowTime(date: Date): string {
		return date.toLocaleString("ru-RU", {
			timeZone: "Europe/Moscow",
			hour12: false,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	async create(
		userId: string,
	): Promise<{ email: string; expiresAt: string; expiresAtFormatted: string }> {
		const config = await this.ensureUser(userId);
		const count = await this.getActiveCount(userId);

		if (count >= config.maxBoxes) {
			throw new Error("Лимит ящиков исчерпан");
		}

		let email: string | undefined;
		let inserted = false;

		while (!inserted) {
			email = this.generateEmail();
			try {
				const expiresAt = new Date(Date.now() + config.rentalHours * 60 * 60 * 1000);
				const expiresAtISO = expiresAt.toISOString();
				const expiresAtFormatted = this.formatMoscowTime(expiresAt);

				await this.db
					.prepare(
						`INSERT INTO mailboxes (email, user_id, expires_at, status) VALUES (?, ?, ?, 'active')`,
					)
					.bind(email, userId, expiresAtISO)
					.run();

				inserted = true;
				return { email, expiresAt: expiresAtISO, expiresAtFormatted };
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

	async createCustom(
		userId: string,
		email: string,
	): Promise<{ expiresAt: string; expiresAtFormatted: string }> {
		const config = await this.ensureUser(userId);
		const count = await this.getActiveCount(userId);

		if (count >= config.maxBoxes) {
			throw new Error("Лимит ящиков исчерпан");
		}

		const exists = await this.exists(email);
		if (exists) {
			throw new Error("Ящик уже существует");
		}

		const expiresAt = new Date(Date.now() + config.rentalHours * 60 * 60 * 1000);
		const expiresAtISO = expiresAt.toISOString();
		const expiresAtFormatted = this.formatMoscowTime(expiresAt);

		try {
			await this.db
				.prepare(
					`INSERT INTO mailboxes (email, user_id, expires_at, status) VALUES (?, ?, ?, 'active')`,
				)
				.bind(email, userId, expiresAtISO)
				.run();
		} catch (e) {
			const err = e as Error;
			if (err.message.includes("UNIQUE")) {
				throw new Error("Ящик уже существует");
			}
			throw err;
		}

		return { expiresAt: expiresAtISO, expiresAtFormatted };
	}

	async list(userId: string): Promise<{
		own: (Mailbox & { expiresAtFormatted: string })[];
		available: Mailbox[];
	}> {
		await this.expireAll();

		const ownRaw = await this.db
			.prepare(
				`SELECT email, created_at, expires_at, status FROM mailboxes WHERE user_id = ? AND status = 'active'`,
			)
			.bind(userId)
			.all<Mailbox & { expires_at: string }>();

		const own = (ownRaw.results || []).map((mailbox) => {
			const expiresAt = new Date(mailbox.expires_at);

			return {
				...mailbox,
				expiresAtFormatted: this.formatMoscowTime(expiresAt),
			};
		});

		const available = await this.db
			.prepare(
				`SELECT email, created_at, expires_at, status FROM mailboxes WHERE user_id != ? AND status = 'expired'`,
			)
			.bind(userId)
			.all<Mailbox>();

		return { own, available: available.results || [] };
	}

	async select(userId: string, email: string): Promise<{ expiresAtFormatted: string }> {
		await this.expireAll();

		const config = await this.getRoleConfig(userId);
		const count = await this.getActiveCount(userId);
		if (count >= config.maxBoxes) {
			throw new Error("Лимит ящиков исчерпан");
		}

		const exists = await this.db
			.prepare(`SELECT id, status FROM mailboxes WHERE email = ?`)
			.bind(email)
			.first<{ id: number; status: string }>();

		if (!exists || exists.status !== "expired") {
			throw new Error("Ящик недоступен");
		}

		const expiresAt = new Date(Date.now() + config.rentalHours * 60 * 60 * 1000);
		const expiresAtISO = expiresAt.toISOString();
		const expiresAtFormatted = this.formatMoscowTime(expiresAt);

		await this.db
			.prepare(`UPDATE mailboxes SET user_id = ?, status = 'active', expires_at = ? WHERE id = ?`)
			.bind(userId, expiresAtISO, exists.id)
			.run();

		return { expiresAtFormatted };
	}

	async getMailboxStatus(email: string, userId: string): Promise<"active" | "expired" | null> {
		const result = await this.db
			.prepare(`SELECT status FROM mailboxes WHERE email = ? AND user_id = ?`)
			.bind(email, userId)
			.first<{ status: "active" | "expired" }>();

		return result?.status ?? null;
	}

	async deleteMailbox(userId: string, email: string): Promise<void> {
		await this.db.prepare(`DELETE FROM emails WHERE to_address = ?`).bind(email).run();
		await this.db
			.prepare(`DELETE FROM mailboxes WHERE email = ? AND user_id = ?`)
			.bind(email, userId)
			.run();
	}

	// Для cleanup (без user_id)
	async deleteMailboxForCleanup(email: string): Promise<void> {
		await this.db.prepare(`DELETE FROM emails WHERE to_address = ?`).bind(email).run();
		await this.db.prepare(`DELETE FROM mailboxes WHERE email = ?`).bind(email).run();
	}

	async expireAll(): Promise<void> {
		const now = new Date().toISOString();
		await this.db
			.prepare(`UPDATE mailboxes SET status = 'expired' WHERE expires_at < ? AND status = 'active'`)
			.bind(now)
			.run();
	}

	// === УПРАВЛЕНИЕ РОЛЯМИ (для админов / Telegram-бота) ===
	async setUserRole(userId: string, role: "regular" | "vip" | "admin"): Promise<void> {
		if (!ROLE_CONFIGS[role]) throw new Error("Недопустимая роль");

		await this.db
			.prepare(
				`INSERT INTO user_roles (user_id, role) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(userId, role)
			.run();

		// Автоматически обновим лимит ящиков
		await this.syncUserLimits(userId);
	}

	async getUserRole(userId: string): Promise<string> {
		const result = await this.db
			.prepare(`SELECT role FROM user_roles WHERE user_id = ?`)
			.bind(userId)
			.first<{ role: string }>();
		return result?.role || "regular";
	}
}
