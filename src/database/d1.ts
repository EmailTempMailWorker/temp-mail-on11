import type { Attachment, AttachmentSummary } from "@/schemas/attachments";
import type { Email, EmailSummary } from "@/schemas/emails";
import type { DBAttachment, DBEmail, DBJoinedRow } from "@/types/database";

function toTimestamp(date: number | string): number {
	return typeof date === "string" ? new Date(date).getTime() : date;
}

// === INSERT EMAIL ===
export async function insertEmail(db: D1Database, emailData: Email) {
	try {
		const { success, error, meta } = await db
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
export async function getEmailsByRecipient(
	db: D1Database,
	emailAddress: string,
	limit: number,
	offset: number,
) {
	try {
		const { results } = await db
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
			received_at: toTimestamp(row.received_at),
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
export async function getEmailById(db: D1Database, emailId: string) {
	try {
		const emailResult = await db
			.prepare("SELECT * FROM emails WHERE id = ?")
			.bind(emailId)
			.first<DBEmail>();

		if (!emailResult) return { result: null, error: undefined };

		const converted: Email = {
			id: emailResult.id,
			from_address: emailResult.from_address,
			to_address: emailResult.to_address,
			subject: emailResult.subject,
			received_at: toTimestamp(emailResult.received_at),
			html_content: emailResult.html_content,
			text_content: emailResult.text_content,
			has_attachments: Boolean(emailResult.has_attachments),
			attachment_count: emailResult.attachment_count,
		};

		return { result: converted, error: undefined };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { result: null, error };
	}
}

// === DELETE OLD EMAILS ===
export async function deleteOldEmails(db: D1Database, timestamp: number) {
	try {
		const { success, error, meta } = await db
			.prepare("DELETE FROM emails WHERE received_at < ?")
			.bind(timestamp)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === DELETE BY RECIPIENT ===
export async function deleteEmailsByRecipient(db: D1Database, emailAddress: string) {
	try {
		const { success, error, meta } = await db
			.prepare("DELETE FROM emails WHERE to_address = ?")
			.bind(emailAddress)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === DELETE BY ID ===
export async function deleteEmailById(db: D1Database, emailId: string) {
	try {
		const { success, error, meta } = await db
			.prepare("DELETE FROM emails WHERE id = ?")
			.bind(emailId)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === COUNT EMAILS ===
export async function countEmailsByRecipient(db: D1Database, emailAddress: string) {
	try {
		const result = await db
			.prepare("SELECT count(*) as count FROM emails WHERE to_address = ?")
			.bind(emailAddress)
			.first<{ count: number }>();
		return { count: result?.count || 0, error: undefined };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { count: 0, error };
	}
}

// === INSERT ATTACHMENT ===
export async function insertAttachment(db: D1Database, attachmentData: Attachment) {
	try {
		const { success, error, meta } = await db
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
export async function getAttachmentsByEmailId(db: D1Database, emailId: string) {
	try {
		const { results } = await db
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
			created_at: toTimestamp(row.created_at),
		}));

		return { results: converted, error: undefined };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { results: [] as AttachmentSummary[], error };
	}
}

// === GET ATTACHMENT BY ID ===
export async function getAttachmentById(db: D1Database, attachmentId: string) {
	try {
		const result = await db
			.prepare("SELECT * FROM attachments WHERE id = ?")
			.bind(attachmentId)
			.first<DBAttachment>();
		return { result: result ? (result as Attachment) : null, error: undefined };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { result: null, error };
	}
}

// === DELETE ATTACHMENT BY ID ===
export async function deleteAttachmentById(db: D1Database, attachmentId: string) {
	try {
		const { success, error, meta } = await db
			.prepare("DELETE FROM attachments WHERE id = ?")
			.bind(attachmentId)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === DELETE ATTACHMENTS BY EMAIL ID ===
export async function deleteAttachmentsByEmailId(db: D1Database, emailId: string) {
	try {
		const { success, error, meta } = await db
			.prepare("DELETE FROM attachments WHERE email_id = ?")
			.bind(emailId)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === UPDATE ATTACHMENT INFO ===
export async function updateEmailAttachmentInfo(
	db: D1Database,
	emailId: string,
	hasAttachments: boolean,
	attachmentCount: number,
) {
	try {
		const { success, error, meta } = await db
			.prepare("UPDATE emails SET has_attachments = ?, attachment_count = ? WHERE id = ?")
			.bind(hasAttachments ? 1 : 0, attachmentCount, emailId)
			.run();
		return { success, error, meta };
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { success: false, error, meta: undefined };
	}
}

// === GET EMAILS WITH ATTACHMENTS (JOIN) ===
export async function getEmailsWithAttachments(
	db: D1Database,
	emailAddress: string,
	limit: number,
	offset: number,
) {
	try {
		const { results } = await db
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

		const emailsWithAttachments = Array.from(emailMap.values()).map((e) => e.email);
		const allAttachments = Array.from(emailMap.values()).flatMap(({ email, attachments }) =>
			attachments.map((att) => ({
				...att,
				email_id: email.id,
				email_subject: email.subject,
				email_received_at: email.received_at,
			})),
		);

		return {
			results: allAttachments as AttachmentSummary[],
			emails: emailsWithAttachments,
			error: undefined,
		};
	} catch (e) {
		const error = e instanceof Error ? e : new Error(String(e));
		return { results: [], emails: [], error };
	}
}
