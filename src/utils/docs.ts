import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { DOMAINS_SET } from "@/config/domains";

export function setupDocumentation(app: OpenAPIHono<{ Bindings: CloudflareBindings }>) {
	// OpenAPI Documentation
	app.doc("/openapi.json", {
		openapi: "3.0.0",
		info: {
			version: "1.0.0",
			title: "Temp Mail API",
			description: `
# Temporary Email Service API

A simple and fast temporary email service that allows you to receive emails without registration.

## Features
- Receive emails on temporary addresses
- Multiple supported domains
- Real-time email retrieval
- No registration required
- Automatic cleanup
- **Telegram bot integration** (personal inboxes)

## Response Format
- **Success responses** include \`success: true\` and a \`result\` field
- **Error responses** include \`success: false\` and an \`error\` object
- **Validation errors** include \`success: false\` and detailed error information

## Supported Domains
This API currently supports the following email domains:
${`\n${Array.from(DOMAINS_SET)
	.map((domain) => `- ${domain}`)
	.join("\n")}`}

**Repository**: [github.com/EmailTempMailWorker/temp-mail-on11](https://github.com/EmailTempMailWorker/temp-mail-on11)  
**Issues**: [Report bugs or request features](https://github.com/EmailTempMailWorker/temp-mail-on11/issues)
`,
			contact: {
				name: "API Support",
				url: "https://github.com/EmailTempMailWorker/temp-mail-on11",
			},
			license: {
				name: "MIT",
				url: "https://github.com/EmailTempMailWorker/temp-mail-on11/blob/main/LICENSE",
			},
		},
		servers: [
			{
				url: "https://api.on11.ru",
				description: "Production server",
			},
		],
		tags: [
			{
				name: "Emails",
				description: "Operations for managing emails by email address",
			},
			{
				name: "Inbox",
				description: "Operations for individual email messages",
			},
			{
				name: "Domains",
				description: "Get information about supported email domains",
			},
			{
				name: "Telegram",
				description: "Bot integration and personal inboxes",
			},
		],
		"x-repository": "https://github.com/EmailTempMailWorker/temp-mail-on11",
		"x-issues": "https://github.com/EmailTempMailWorker/temp-mail-on11/issues",
	});

	// Swagger UI - Traditional documentation
	app.get("/swagger", swaggerUI({ url: "/openapi.json" }));

	// Scalar - Modern documentation
	app.get(
		"/",
		Scalar({
			url: "/openapi.json",
			theme: "purple",
		}),
	);
}
