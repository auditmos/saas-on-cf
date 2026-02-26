export class AppError extends Error {
	constructor(
		message: string,
		public code: string,
		public status?: number,
		public field?: string,
	) {
		super(message);
		this.name = "AppError";
	}
}
