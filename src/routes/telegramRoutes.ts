import { Hono } from "hono";
import type { CloudflareBindings } from "@/types/env";
import { handleTelegramBotUpdate } from "@/utils/telegramBot";

export const telegramRoutes = new Hono<{ Bindings: CloudflareBindings }>();

telegramRoutes.post("/api/telegram", async (c) => {
	const body = await c.req.json();
	return handleTelegramBotUpdate(body, c.env);
});
