export class ApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number = 500,
		public readonly code?: string,
	) {
		super(message);
		this.name = "ApiError";
		Object.setPrototypeOf(this, ApiError.prototype);
	}
}

/**
 * Helper function to check if error is an instance of Error
 */
export function isError(error: unknown): error is Error {
	return error instanceof Error;
}

/**
 * Helper function to get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
	if (isError(error)) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "Unknown error occurred";
}

/**
 * Helper function to create error response object
 */
export function createErrorResponse(error: unknown): { error: string; code?: string } {
	if (error instanceof ApiError) {
		return {
			error: error.message,
			...(error.code && { code: error.code }),
		};
	}
	if (isError(error)) {
		return { error: error.message };
	}
	return { error: "Internal server error" };
}
