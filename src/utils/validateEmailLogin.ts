export function validateEmailLogin(
	login: string,
): { valid: true } | { valid: false; error: string } {
	const trimmed = login.trim().toLowerCase();

	if (!trimmed) return { valid: false, error: "Имя не может быть пустым." };
	if (trimmed.length > 64)
		return { valid: false, error: "Имя слишком длинное (макс. 64 символа)." };

	const validRegex = /^[a-z0-9._-]+$/;
	if (!validRegex.test(trimmed)) {
		return { valid: false, error: "Только латинские буквы, цифры, ., _, -." };
	}

	if (/^[.-]/.test(trimmed) || /[.-]$/.test(trimmed)) {
		return { valid: false, error: "Не может начинаться/заканчиваться на . или -." };
	}

	if (trimmed.includes("..")) {
		return { valid: false, error: "Две точки подряд запрещены." };
	}

	const reserved = [
		"admin",
		"postmaster",
		"abuse",
		"root",
		"webmaster",
		"support",
		"mail",
		"ecomonx008",
	];
	if (reserved.includes(trimmed)) {
		return { valid: false, error: `Имя "${trimmed}" зарезервировано.` };
	}

	return { valid: true };
}
