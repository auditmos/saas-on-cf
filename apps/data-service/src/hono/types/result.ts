export interface AppError {
	code: string;
	message: string;
	status: number;
	field?: string;
}

export type Result<T, E = AppError> = { ok: true; data: T } | { ok: false; error: E };
