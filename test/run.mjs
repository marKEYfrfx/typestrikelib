// Bundles each test/*.test.ts with esbuild (swapping "cs_script/point_script" for test/mock)
// and runs it in Node. Usage: npm test
import * as esbuild from "esbuild";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, ".out");
const mockPath = join(here, "mock", "point_script.ts");

const mockPlugin = {
    name: "mock-point-script",
    setup(build) {
        build.onResolve({ filter: /^cs_script\/point_script$/ }, () => ({ path: mockPath }));
    },
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const only = process.argv[2];
const files = readdirSync(here).filter((f) => f.endsWith(".test.ts") && (!only || f.includes(only)));
globalThis.__results = [];

for (const file of files) {
    const outfile = join(outDir, file.replace(/\.ts$/, ".mjs"));
    await esbuild.build({
        entryPoints: [join(here, file)],
        bundle: true,
        format: "esm",
        platform: "neutral",
        outfile,
        plugins: [mockPlugin],
        loader: { ".xml": "text", ".css": "text" },
        logLevel: "error",
    });
    const mod = await import(pathToFileURL(outfile).href);
    await mod.run(file);
}

let failed = 0;
let lastFile = "";
for (const r of globalThis.__results) {
    if (r.file !== lastFile) console.log(`\n${r.file}`);
    lastFile = r.file;
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}`);
    if (!r.ok) {
        failed++;
        console.log(`       ${r.error.split("\n").slice(0, 4).join("\n       ")}`);
    }
}
const total = globalThis.__results.length;
console.log(`\n${total - failed}/${total} passed`);
process.exitCode = failed > 0 ? 1 : 0;
