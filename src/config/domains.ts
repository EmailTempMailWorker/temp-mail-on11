// List of supported email domains

export const DOMAINS = [
	{
		owner: "Aleksander",
		domain: "on11.ru",
	},
] satisfies {
	owner: string;
	domain: string;
}[];

export const DOMAINS_SET = new Set(DOMAINS.map((d) => d.domain));
