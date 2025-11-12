import * as db from "@/database/d1";
import { MailboxDB } from "@/database/mailbox";
import type { CloudflareBindings } from "@/types/env";
import { now } from "@/utils/helpers";
import { logInfo } from "@/utils/logger";

/**
 * Cloudflare Scheduled Function
 * Delete emails older than 4 hours
 */
export async function handleScheduled(
	_event: ScheduledEvent,
	env: CloudflareBindings,
	// ctx: ExecutionContext,
) {
	// const cutoffTimestamp = now() - env.HOURS_TO_DELETE_D1 * 60 * 60;
	const hours = parseInt(env.HOURS_TO_DELETE_D1, 10) || 3; // 3 по умолчанию
	const cutoffTimestamp = now() - hours * 60 * 60;

	const { success, error } = await db.deleteOldEmails(env.D1, cutoffTimestamp);

	if (success) {
		logInfo("Email cleanup completed successfully.");
		// ctx.waitUntil(sendMessage("Email cleanup completed successfully.", env));
	} else {
		throw new Error(`Email cleanup failed: ${error}`);
	}

	// 2. Удаляем истёкшие ящики
    try {
        await cleanupExpiredMailboxes(env);
    } catch (err) {
        console.error("[CLEANUP] Ошибка при удалении истёкших ящиков:", err);
        // throw err; // или можно не прерывать, если критичность низкая
    }
}

export async function cleanupExpiredMailboxes(env: CloudflareBindings): Promise<void> {
	const db = new MailboxDB(env);

	// 1. Помечаем как expired
	await db.expireAll();

	// 2. Получаем все expired ящики
	const expired = await env.D1.prepare(`SELECT email FROM mailboxes WHERE status = 'expired'`).all<{
		email: string;
	}>();

	// 3. Удаляем ящики + их письма
	for (const { email } of expired.results) {
		await db.deleteMailbox("system", email); // user_id не проверяется
	}

	console.log(`[CLEANUP] Удалено ${expired.results.length} истёкших ящиков и их писем.`);
}
