export function isUniqueViolation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const cause = error.cause;
	if (cause instanceof Error) {
		const pgCode = (cause as Error & { code?: string }).code;
		if (pgCode === "23505") return true;
	}
	return false;
}
