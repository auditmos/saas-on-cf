import { describe, expect, it } from "vitest";
import { ExampleWorkflow } from "./example-workflow";

type StepCallback<T> = () => Promise<T> | T;

interface DoCall {
	name: string;
	result: unknown;
}

interface SleepCall {
	name: string;
	duration: string;
}

function makeStubStep() {
	const doCalls: DoCall[] = [];
	const sleepCalls: SleepCall[] = [];
	const step = {
		async do<T>(name: string, fn: StepCallback<T>): Promise<T> {
			const result = await fn();
			doCalls.push({ name, result });
			return result;
		},
		async sleep(name: string, duration: string): Promise<void> {
			sleepCalls.push({ name, duration });
		},
	};
	return { step, doCalls, sleepCalls };
}

async function runWorkflowOnce() {
	const { step, doCalls, sleepCalls } = makeStubStep();
	const instance = Object.create(ExampleWorkflow.prototype) as ExampleWorkflow;
	await instance.run(
		{ payload: { dataToPassIn: "x" } } as unknown as Parameters<ExampleWorkflow["run"]>[0],
		step as unknown as Parameters<ExampleWorkflow["run"]>[1],
	);
	return { doCalls, sleepCalls };
}

describe("ExampleWorkflow", () => {
	it("produces an integer random number in [1, 10] across many iterations", async () => {
		const ITERATIONS = 500;
		const seen = new Set<number>();
		for (let i = 0; i < ITERATIONS; i++) {
			const { doCalls } = await runWorkflowOnce();
			const randomStep = doCalls.find((c) => c.name === "Get random number");
			expect(randomStep, "workflow must invoke 'Get random number' step").toBeDefined();
			const value = randomStep?.result;
			expect(typeof value).toBe("number");
			const n = value as number;
			expect(Number.isInteger(n)).toBe(true);
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(10);
			seen.add(n);
		}
		expect(
			seen.size,
			"should cover most of the [1,10] range in 500 iterations",
		).toBeGreaterThanOrEqual(8);
	});

	it("passes the random number to step.sleep as a duration string", async () => {
		const { doCalls, sleepCalls } = await runWorkflowOnce();
		const randomStep = doCalls.find((c) => c.name === "Get random number");
		const random = randomStep?.result as number;
		const sleep = sleepCalls.find((c) => c.name === "Wait for random number of seconds");
		expect(sleep?.duration).toBe(`${random} seconds`);
	});
});
