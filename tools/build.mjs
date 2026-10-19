import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "./files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
// Only this fixed, project-owned output folder may be cleaned.
if (dirname(output) !== root.replace(/[\\/]$/, "") || basename(output) !== "dist") {
    throw new Error("Build output must be the project's dist directory.");
}
await rm(output, { recursive: true, force: true });
for (const file of PUBLIC_FILES) {
    const destination = join(output, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, file), destination);
}
// Build configuration is explicit. Local config.js and all other local files are excluded.
const config = { UNSPLASH_ACCESS_KEY: (process.env.UNSPLASH_ACCESS_KEY || "").trim() };
await writeFile(join(output, "config.js"), `window.LUMA_CONFIG = ${JSON.stringify(config)};\n`);
console.log("Built static site in dist/");
