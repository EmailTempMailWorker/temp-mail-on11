import type { Email } from "@/schemas/emails";

export type { Email };

export interface EmailWithContent extends Email {
	text?: string;
	html?: string;
}
