import { Hono } from "hono";
import { handleTelegramUpdate } from "@/utils/telegram";

export const telegramRoutes = new Hono<{ Bindings: CloudflareBindings }>();

telegramRoutes.post("/api/telegram", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	return await handleTelegramUpdate(body, c.env);
});
