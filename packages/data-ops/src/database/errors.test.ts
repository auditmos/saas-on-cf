import { isUniqueViolation } from "./errors";

describe("isUniqueViolation", () => {
	it("returns true for a DrizzleQueryError-shape with cause.code 23505", () => {
		const cause = Object.assign(new Error("duplicate key value violates unique constraint"), {
			code: "23505",
		});
		const error = new Error("Failed query: insert into ...", { cause });

		expect(isUniqueViolation(error)).toBe(true);
	});

	it("returns false when cause.code is a different pg error code", () => {
		const cause = Object.assign(new Error("foreign key violation"), { code: "23503" });
		const error = new Error("Failed query", { cause });

		expect(isUniqueViolation(error)).toBe(false);
	});

	it("returns false when the error has no cause", () => {
		expect(isUniqueViolation(new Error("Failed query"))).toBe(false);
	});

	it("returns false when cause is not an Error instance", () => {
		const error = new Error("Failed query", { cause: "raw string cause" });
		expect(isUniqueViolation(error)).toBe(false);
	});

	it("returns false for non-Error inputs", () => {
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation(undefined)).toBe(false);
		expect(isUniqueViolation("23505")).toBe(false);
		expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(false);
	});
});
