import type { Attachment, AttachmentSummary } from "@/schemas/attachments";
import type { Email, EmailSummary } from "@/schemas/emails";
import type { DBAttachment, DBCountRow, DBEmail, DBJoinedRow } from "@/types/database";

export class DatabaseService {
	constructor(private db: D1Database) {}

	// === INSERT EMAIL ===
	async insertEmail(emailData: Email) {
		try {
			const { success, error, meta } = await this.db
				.prepare(
					`INSERT INTO emails (id, from_address, to_address, subject, received_at, html_content, text_content, has_attachments, attachment_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					emailData.id,
					emailData.from_address,
					emailData.to_address,
					emailData.subject,
					emailData.received_at,
					emailData.html_content,
					emailData.text_content,
					emailData.has_attachments ? 1 : 0,
					emailData.attachment_count,
				)
				.run();

			return { success, error, meta };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { success: false, error, meta: undefined };
		}
	}

	// === GET EMAILS BY RECIPIENT ===
	async getEmailsByRecipient(emailAddress: string, limit: number, offset: number) {
		try {
			const { results } = await this.db
				.prepare(
					`SELECT id, from_address, to_address, subject, received_at, has_attachments, attachment_count
           FROM emails
           WHERE to_address = ?
           ORDER BY received_at DESC
           LIMIT ? OFFSET ?`,
				)
				.bind(emailAddress, limit, offset)
				.all<DBEmail>();

			const convertedResults: EmailSummary[] = results.map((row) => ({
				id: row.id,
				from_address: row.from_address,
				to_address: row.to_address,
				subject: row.subject,
				received_at: row.received_at,
				has_attachments: Boolean(row.has_attachments),
				attachment_count: row.attachment_count,
			}));

			return { results: convertedResults, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { results: [] as EmailSummary[], error };
		}
	}

	// === GET EMAIL BY ID ===
	async getEmailById(emailId: string) {
		try {
			const { results } = await this.db
				.prepare(`SELECT * FROM emails WHERE id = ?`)
				.bind(emailId)
				.all<DBEmail>();

			if (!results[0]) return { result: undefined, error: undefined };

			const row = results[0];
			const converted: Email = {
				id: row.id,
				from_address: row.from_address,
				to_address: row.to_address,
				subject: row.subject,
				received_at: row.received_at,
				html_content: row.html_content,
				text_content: row.text_content,
				has_attachments: Boolean(row.has_attachments),
				attachment_count: row.attachment_count,
			};

			return { result: converted, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { result: undefined, error };
		}
	}

	// === COUNT EMAILS ===
	async countEmailsByRecipient(emailAddress: string) {
		try {
			const { results } = await this.db
				.prepare(`SELECT COUNT(*) as count FROM emails WHERE to_address = ?`)
				.bind(emailAddress)
				.all<DBCountRow>();

			return { count: results[0]?.count ?? 0, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { count: 0, error };
		}
	}

	// === DELETE BY RECIPIENT ===
	async deleteEmailsByRecipient(emailAddress: string) {
		try {
			const { meta } = await this.db
				.prepare(`DELETE FROM emails WHERE to_address = ?`)
				.bind(emailAddress)
				.run();

			return { meta, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { meta: undefined, error };
		}
	}

	// === DELETE BY ID ===
	async deleteEmailById(emailId: string) {
		try {
			const { meta } = await this.db.prepare(`DELETE FROM emails WHERE id = ?`).bind(emailId).run();

			return { meta, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { meta: undefined, error };
		}
	}

	// === INSERT ATTACHMENT ===
	async insertAttachment(attachmentData: Attachment) {
		try {
			const { success, error, meta } = await this.db
				.prepare(
					`INSERT INTO attachments (id, email_id, filename, content_type, size, r2_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					attachmentData.id,
					attachmentData.email_id,
					attachmentData.filename,
					attachmentData.content_type,
					attachmentData.size,
					attachmentData.r2_key,
					attachmentData.created_at,
				)
				.run();

			return { success, error, meta };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { success: false, error, meta: undefined };
		}
	}

	// === GET ATTACHMENTS BY EMAIL ID ===
	async getAttachmentsByEmailId(emailId: string) {
		try {
			const { results } = await this.db
				.prepare(
					`SELECT id, filename, content_type, size, created_at
           FROM attachments
           WHERE email_id = ?
           ORDER BY created_at ASC`,
				)
				.bind(emailId)
				.all<DBAttachment>();

			const converted: AttachmentSummary[] = results.map((row) => ({
				id: row.id,
				filename: row.filename,
				content_type: row.content_type,
				size: row.size,
				created_at: row.created_at,
			}));

			return { results: converted, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { results: [] as AttachmentSummary[], error };
		}
	}

	// === GET ATTACHMENT BY ID ===
	async getAttachmentById(attachmentId: string) {
		try {
			const { results } = await this.db
				.prepare(`SELECT * FROM attachments WHERE id = ?`)
				.bind(attachmentId)
				.all<DBAttachment>();

			if (!results[0]) return { result: undefined, error: undefined };

			const row = results[0];
			const converted: Attachment = {
				id: row.id,
				email_id: row.email_id,
				filename: row.filename,
				content_type: row.content_type,
				size: row.size,
				r2_key: row.r2_key,
				created_at: row.created_at,
			};

			return { result: converted, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { result: undefined, error };
		}
	}

	// === DELETE ATTACHMENT BY ID ===
	async deleteAttachmentById(attachmentId: string) {
		try {
			const { success, error, meta } = await this.db
				.prepare(`DELETE FROM attachments WHERE id = ?`)
				.bind(attachmentId)
				.run();

			return { success, error, meta };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { success: false, error, meta: undefined };
		}
	}

	// === UPDATE ATTACHMENT INFO ===
	async updateEmailAttachmentInfo(
		emailId: string,
		hasAttachments: boolean,
		attachmentCount: number,
	) {
		try {
			const { success, error, meta } = await this.db
				.prepare(
					`UPDATE emails
           SET has_attachments = ?, attachment_count = ?
           WHERE id = ?`,
				)
				.bind(hasAttachments ? 1 : 0, attachmentCount, emailId)
				.run();

			return { success, error, meta };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { success: false, error, meta: undefined };
		}
	}

	// === GET EMAILS WITH ATTACHMENTS (JOIN) ===
	async getEmailsWithAttachments(emailAddress: string, limit: number, offset: number) {
		try {
			const { results } = await this.db
				.prepare(
					`SELECT
          e.id, e.from_address, e.to_address, e.subject, e.received_at,
          e.has_attachments, e.attachment_count,
          a.id as att_id, a.filename, a.content_type, a.size, a.created_at as att_created_at
        FROM emails e
        LEFT JOIN attachments a ON e.id = a.email_id
        WHERE e.to_address = ?
        ORDER BY e.received_at DESC, a.created_at ASC
        LIMIT ? OFFSET ?`,
				)
				.bind(emailAddress, limit, offset)
				.all<DBJoinedRow>();

			const emailMap = new Map<
				string,
				{
					email: EmailSummary;
					attachments: AttachmentSummary[];
				}
			>();

			for (const row of results) {
				const emailId = row.id;

				let entry = emailMap.get(emailId);
				if (!entry) {
					entry = {
						email: {
							id: row.id,
							from_address: row.from_address,
							to_address: row.to_address,
							subject: row.subject,
							received_at: row.received_at,
							has_attachments: Boolean(row.has_attachments),
							attachment_count: row.attachment_count,
						},
						attachments: [],
					};
					emailMap.set(emailId, entry);
				}

				if (
					row.att_id &&
					row.filename &&
					row.content_type &&
					row.size !== undefined &&
					row.att_created_at !== undefined
				) {
					entry.attachments.push({
						id: row.att_id,
						filename: row.filename,
						content_type: row.content_type,
						size: row.size,
						created_at: row.att_created_at,
					});
				}
			}

			// ← ИСПРАВЛЕНО: добавляем attachments в email
			const emailsWithAttachments = Array.from(emailMap.values()).map((entry) => ({
				...entry.email,
				attachments: entry.attachments,
			}));

			const allAttachments = emailsWithAttachments.flatMap((email) =>
				email.attachments.map((att: AttachmentSummary) => ({
					...att,
					email_id: email.id,
					email_subject: email.subject,
					email_received_at: email.received_at,
				})),
			);

			return { results: allAttachments, error: undefined };
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return { results: [], error };
		}
	}
}
