export interface CloudflareBindings {
	D1: D1Database;
	R2: R2Bucket;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	TELEGRAM_LOG_ENABLE?: string;
	HOURS_TO_DELETE_D1: string;
	CLOUDFLARE_API_TOKEN: string;
}
