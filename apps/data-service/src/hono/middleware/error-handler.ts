import { Context } from 'hono';
import { ApiError, createErrorResponse, isError } from '../utils/error-handling';

/**
 * Valid HTTP status codes that Hono accepts
 */
const VALID_STATUS_CODES = [
  200, 201, 202, 204, 206, 207, 208, 226,
  300, 301, 302, 303, 304, 305, 306, 307, 308,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511
] as const;

type ValidStatusCode = typeof VALID_STATUS_CODES[number];

/**
 * Converts a number to a valid HTTP status code
 * Falls back to 500 if the code is not valid
 */
function toValidStatusCode(code: number): ValidStatusCode {
  if (VALID_STATUS_CODES.includes(code as ValidStatusCode)) {
    return code as ValidStatusCode;
  }
  return 500;
}

/**
 * Error handler middleware for Hono
 * Handles all errors and returns appropriate JSON responses
 */
export function errorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (e: unknown) {
      console.error('Request error:', e);
      
      if (e instanceof ApiError) {
        c.status(toValidStatusCode(e.statusCode));
        return c.json(createErrorResponse(e));
      }
      
      if (isError(e)) {
        c.status(500);
        return c.json(createErrorResponse(e));
      }
      
      c.status(500);
      return c.json(createErrorResponse(e));
    }
  };
}

/**
 * Error handler for Hono onError hook
 * This is the preferred way to handle errors in Hono
 */
export function onErrorHandler(err: unknown, c: Context) {
  console.error('Request error:', err);
  
  if (err instanceof ApiError) {
    c.status(toValidStatusCode(err.statusCode));
    return c.json(createErrorResponse(err));
  }
  
  if (isError(err)) {
    c.status(500);
    return c.json(createErrorResponse(err));
  }
  
  c.status(500);
  return c.json(createErrorResponse(err));
}

