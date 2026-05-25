const NON_NEON_ADAPTERS = ["drizzle-orm/postgres-js", "drizzle-orm/node-postgres"] as const;

type NonNeonAdapter = (typeof NON_NEON_ADAPTERS)[number];

export interface DriftReport {
	adapter: "neon" | "non-neon";
	adapterImport: string;
	missingHyperdrive: string[];
}

export interface DriftInput {
	setupSource: string;
	wranglerSources: Array<{ name: string; source: string }>;
}

function detectAdapter(setupSource: string): { kind: "neon" | "non-neon"; importPath: string } {
	for (const adapter of NON_NEON_ADAPTERS) {
		if (setupSource.includes(`"${adapter}"`) || setupSource.includes(`'${adapter}'`)) {
			return { kind: "non-neon", importPath: adapter satisfies NonNeonAdapter };
		}
	}
	return { kind: "neon", importPath: "drizzle-orm/neon-http" };
}

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface WranglerConfig {
	hyperdrive?: unknown[];
	env?: Record<string, { hyperdrive?: unknown[] }>;
}

function hasHyperdriveBinding(wranglerSource: string): boolean {
	const parsed = JSON.parse(stripJsoncComments(wranglerSource)) as WranglerConfig;
	if (Array.isArray(parsed.hyperdrive) && parsed.hyperdrive.length > 0) return true;
	for (const block of Object.values(parsed.env ?? {})) {
		if (Array.isArray(block?.hyperdrive) && block.hyperdrive.length > 0) return true;
	}
	return false;
}

export function checkHyperdriveDrift(input: DriftInput): DriftReport {
	const adapter = detectAdapter(input.setupSource);
	if (adapter.kind === "neon") {
		return { adapter: "neon", adapterImport: adapter.importPath, missingHyperdrive: [] };
	}
	const missingHyperdrive = input.wranglerSources
		.filter((w) => !hasHyperdriveBinding(w.source))
		.map((w) => w.name);
	return { adapter: "non-neon", adapterImport: adapter.importPath, missingHyperdrive };
}
