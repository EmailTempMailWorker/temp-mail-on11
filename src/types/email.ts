import type { Email } from "@/schemas/emails";

export interface EmailWithContent extends Email {
	text?: string;
	html?: string;
}
