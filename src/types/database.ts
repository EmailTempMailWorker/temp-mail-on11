export interface DBEmail {
	id: string;
	from_address: string;
	to_address: string;
	subject: string | null;
	received_at: number;
	html_content: string | null;
	text_content: string | null;
	has_attachments: 0 | 1;
	attachment_count: number;
}

export interface DBAttachment {
	id: string;
	email_id: string;
	filename: string;
	content_type: string;
	size: number;
	r2_key: string;
	created_at: number;
}

export interface DBCountRow {
	count: number;
}

export interface DBJoinedRow {
	id: string;
	from_address: string;
	to_address: string;
	subject: string | null;
	received_at: number;
	has_attachments: 0 | 1;
	attachment_count: number;

	att_id?: string;
	filename?: string;
	content_type?: string;
	size?: number;
	att_created_at?: number;
}
