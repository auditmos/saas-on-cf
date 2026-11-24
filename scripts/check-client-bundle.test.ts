import { expect, it } from "vitest";
import { collectAssets } from "./check-client-bundle";

it("counts shared files once and follows static imports for matched route chunks", () => {
	const manifest = {
		entry: { file: "entry.js", imports: ["shared"], assets: ["base.css"] },
		route: {
			file: "route.js",
			imports: ["shared"],
			dynamicImports: ["optional"],
			css: ["base.css", "route.css"],
		},
		shared: { file: "shared.js", imports: ["vendor"] },
		vendor: { file: "vendor.js" },
		optional: { file: "optional.js" },
	};

	expect(collectAssets(manifest, ["entry", "route"])).toEqual(
		new Set(["entry.js", "base.css", "route.js", "route.css", "shared.js", "vendor.js"]),
	);
	expect(() => collectAssets(manifest, ["missing"])).toThrow("Missing client manifest entry");
});
