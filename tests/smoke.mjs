import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

assert.match(html, /<title>Luma/);
assert.match(html, /id="search-form"/);
assert.match(html, /id="settings-dialog"/);
assert.match(html, /aria-live="polite"/);
assert.match(script, /content_filter:\s*["']high["']/);
assert.doesNotMatch(script, /UNSPLASH_ACCESS_KEY\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/);

console.log("Luma smoke checks passed");
