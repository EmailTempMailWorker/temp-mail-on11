export interface DBEmailRow {
	id: string;
	inbox: string;
	from_address: string;
	to_address: string;
	subject: string;
	body_text: string | null;
	body_html: string | null;
	has_attachments: number;
	received_at: string;

	att_id?: string;
	filename?: string;
	content_type?: string;
	size?: number;
	storage_key?: string;
	att_created_at?: string;
	attachment_count?: number;
}

export interface EmailSummary {
	id: string;
	from_address: string;
	to_address: string;
	subject: string | null;
	received_at: number;
	has_attachments: boolean;
	attachment_count: number;
}

export interface EmailWithAttachments {
	id: string;
	inbox: string;
	from_address: string;
	to_address: string;
	subject: string;
	body_text: string | null;
	body_html: string | null;
	has_attachments: boolean;
	received_at: string;
	attachments: Array<{
		id: string;
		filename: string;
		content_type: string;
		size: number;
		storage_key: string;
		created_at?: string;
	}>;
}

// Почтовый email (PostalMime)
export interface ParsedEmail {
	from: string;
	to: string;
	subject: string;
	text?: string;
	html?: string;
	attachments?: Array<{
		filename: string;
		contentType: string;
		content: Uint8Array;
	}>;
}
