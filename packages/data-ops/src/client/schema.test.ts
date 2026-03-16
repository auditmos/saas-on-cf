import {
	ClientCreateRequestSchema,
	ClientUpdateRequestSchema,
	IdParamSchema,
	PaginationRequestSchema,
} from "./schema";

describe("ClientCreateRequestSchema", () => {
	it("accepts valid input", () => {
		const result = ClientCreateRequestSchema.safeParse({
			name: "John",
			surname: "Doe",
			email: "john@example.com",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty name", () => {
		const result = ClientCreateRequestSchema.safeParse({
			name: "",
			surname: "Doe",
			email: "john@example.com",
		});
		expect(result.success).toBe(false);
	});

	it("rejects name exceeding 30 chars", () => {
		const result = ClientCreateRequestSchema.safeParse({
			name: "a".repeat(31),
			surname: "Doe",
			email: "john@example.com",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid email", () => {
		const result = ClientCreateRequestSchema.safeParse({
			name: "John",
			surname: "Doe",
			email: "not-an-email",
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing fields", () => {
		const result = ClientCreateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

describe("ClientUpdateRequestSchema", () => {
	it("accepts partial update with one field", () => {
		const result = ClientUpdateRequestSchema.safeParse({ name: "Jane" });
		expect(result.success).toBe(true);
	});

	it("accepts all fields", () => {
		const result = ClientUpdateRequestSchema.safeParse({
			name: "Jane",
			surname: "Smith",
			email: "jane@example.com",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty object (refine: at least one field)", () => {
		const result = ClientUpdateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects empty string name", () => {
		const result = ClientUpdateRequestSchema.safeParse({ name: "" });
		expect(result.success).toBe(false);
	});
});

describe("PaginationRequestSchema", () => {
	it("applies defaults when empty", () => {
		const result = PaginationRequestSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(10);
			expect(result.data.offset).toBe(0);
		}
	});

	it("coerces string numbers", () => {
		const result = PaginationRequestSchema.safeParse({ limit: "25", offset: "5" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(25);
			expect(result.data.offset).toBe(5);
		}
	});

	it("rejects limit above 100", () => {
		const result = PaginationRequestSchema.safeParse({ limit: 101 });
		expect(result.success).toBe(false);
	});

	it("rejects negative offset", () => {
		const result = PaginationRequestSchema.safeParse({ offset: -1 });
		expect(result.success).toBe(false);
	});
});

describe("IdParamSchema", () => {
	it("accepts valid uuid", () => {
		const result = IdParamSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
		expect(result.success).toBe(true);
	});

	it("rejects non-uuid string", () => {
		const result = IdParamSchema.safeParse({ id: "not-a-uuid" });
		expect(result.success).toBe(false);
	});

	it("rejects missing id", () => {
		const result = IdParamSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
