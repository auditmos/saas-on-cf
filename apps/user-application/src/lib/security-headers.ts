export const applySecurityHeaders = (response: Response): Response => {
	const headers = new Headers(response.headers);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	headers.set(
		"Content-Security-Policy",
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https:",
			"font-src 'self' data:",
			"connect-src 'self' https:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; "),
	);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};
