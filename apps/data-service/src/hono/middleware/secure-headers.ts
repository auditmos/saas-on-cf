import { secureHeaders } from "hono/secure-headers";

export const createSecureHeadersMiddleware = () =>
	secureHeaders({
		strictTransportSecurity: "max-age=31536000; includeSubDomains",
		referrerPolicy: "strict-origin-when-cross-origin",
		xFrameOptions: "DENY",
		contentSecurityPolicy: {
			defaultSrc: ["'none'"],
			frameAncestors: ["'none'"],
		},
		permissionsPolicy: {
			camera: [],
			microphone: [],
			geolocation: [],
		},
	});
