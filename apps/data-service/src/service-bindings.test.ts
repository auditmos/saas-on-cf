import { describe, expectTypeOf, it } from "vitest";

describe("service-bindings.d.ts", () => {
	it("defines ExampleWorkflowParams (correct spelling)", () => {
		expectTypeOf<ExampleWorkflowParams>().not.toBeAny();
	});

	it("types ExampleWorkflowParams.dataToPassIn explicitly (not implicit any)", () => {
		expectTypeOf<ExampleWorkflowParams["dataToPassIn"]>().not.toBeAny();
	});

	it("types ExampleQueueMessage.messageData explicitly (not implicit any)", () => {
		expectTypeOf<ExampleQueueMessage["messageData"]>().not.toBeAny();
	});

	it("does not leak the ExampleWorkflowParmas typo as a global type", () => {
		// @ts-expect-error - the misspelled "Parmas" must not exist anywhere
		type _Typo = ExampleWorkflowParmas;
	});
});
