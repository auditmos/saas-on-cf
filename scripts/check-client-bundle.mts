import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

type Manifest = Record<
	string,
	{ file: string; isEntry?: boolean; imports?: string[]; css?: string[]; assets?: string[] }
>;

const routes = {
	"/": ["index"],
	"/signin": ["signin"],
	"/dashboard/binding/list": [
		"_auth/route",
		"_auth/dashboard/route",
		"_auth/dashboard/binding/route",
		"_auth/dashboard/binding/list",
	],
};

const limits = {
	"total JS": 205_000,
	"route JS": 50_000,
	CSS: 20_000,
};

export function collectAssets(manifest: Manifest, roots: string[]): Set<string> {
	const assets = new Set<string>();
	const visited = new Set<string>();
	const pending = [...roots];

	for (const key of pending) {
		if (visited.has(key)) continue;
		visited.add(key);
		const chunk = manifest[key];
		assert.ok(chunk, `Missing client manifest entry: ${key}`);
		pending.push(...(chunk.imports ?? []));
		for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
			assets.add(file);
		}
	}

	return assets;
}

function checkBundle() {
	const clientDir = resolve(import.meta.dirname, "../apps/user-application/dist/client");
	const manifest = JSON.parse(
		readFileSync(join(clientDir, ".vite/manifest.json"), "utf8"),
	) as Manifest;
	const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
	assert.equal(entries.length, 1, "Expected a single client entry in the Vite manifest");
	const shared = collectAssets(manifest, entries);
	const bytes = new Map<string, number>();

	function measure(files: string[]) {
		return files.reduce((total, file) => {
			if (!bytes.has(file)) {
				bytes.set(
					file,
					brotliCompressSync(readFileSync(join(clientDir, file)), {
						params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
					}).length,
				);
			}
			return total + (bytes.get(file) ?? 0);
		}, 0);
	}

	for (const [route, components] of Object.entries(routes)) {
		const files = collectAssets(manifest, [
			...entries,
			...components.map((component) => `src/routes/${component}.tsx?tsr-split=component`),
		]);
		const js = [...files].filter((file) => file.endsWith(".js"));
		const usage = {
			"total JS": measure(js),
			"route JS": measure(js.filter((file) => !shared.has(file))),
			CSS: measure([...files].filter((file) => file.endsWith(".css"))),
		};
		for (const metric of Object.keys(limits) as Array<keyof typeof limits>) {
			const line = `${route} · ${metric}: ${usage[metric]} / ${limits[metric]} B Brotli`;
			if (usage[metric] > limits[metric]) {
				console.error(`Over budget: ${line}`);
				process.exitCode = 1;
			} else {
				console.log(line);
			}
		}
	}
}

if (import.meta.main) checkBundle();
