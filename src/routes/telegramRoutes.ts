import { Hono } from "hono";
import type { CloudflareBindings } from "@/types/env";
import { handleTelegramUpdate } from "@/utils/telegram";

export const telegramRoutes = new Hono<{ Bindings: CloudflareBindings }>();

telegramRoutes.post("/api/telegram", async (c) => {
	const body = await c.req.json();
	return handleTelegramUpdate(body, c.env);
});
