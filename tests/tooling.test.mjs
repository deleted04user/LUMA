import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "../tools/serve.mjs";
import { PUBLIC_FILES } from "../tools/files.mjs";

function removeFixture(root, prefix) {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith(prefix));
    return rm(root, { recursive: true, force: true });
}

test("static server serves modules with correct types and keeps private files inaccessible", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "luma-server-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "index.html"), "<title>Luma</title>");
    await writeFile(join(root, "src/api.js"), "export const ok = true;");
    await writeFile(join(root, ".env"), "never serve this");
    const server = createStaticServer(root);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        await removeFixture(root, "luma-server-");
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.match(await (await fetch(base)).text(), /Luma/);
    const module = await fetch(`${base}/src/api.js`);
    assert.match(module.headers.get("content-type"), /text\/javascript/);
    assert.equal(module.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await fetch(`${base}/config.js`)).status, 200);
    assert.match(await (await fetch(`${base}/config.js`)).text(), /LUMA_CONFIG = \{\}/);
    await writeFile(join(root, "config.js"), "window.LUMA_CONFIG = {UNSPLASH_ACCESS_KEY: 'local'};");
    assert.match(await (await fetch(`${base}/config.js`)).text(), /local/);
    const head = await fetch(base, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
    for (const path of ["/.env", "/package.json", "/.git/config", "/%2e%2e%2f.env", "/src/missing.js"]) {
        assert.equal((await fetch(base + path)).status, 404);
    }
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await fetch(`${base}/style.css`)).status, 404);
});

test("build produces a complete static site, uses explicit env config, and excludes development files", async (t) => {
    const source = fileURLToPath(new URL("../", import.meta.url));
    const root = await mkdtemp(join(tmpdir(), "luma-build-"));
    t.after(() => removeFixture(root, "luma-build-"));
    for (const file of [...PUBLIC_FILES, "tools/build.mjs", "tools/files.mjs"]) {
        await mkdir(join(root, file, ".."), { recursive: true });
        await cp(join(source, file), join(root, file));
    }
    await writeFile(join(root, ".env"), "UNSPLASH_ACCESS_KEY=build-test-key\n");
    await writeFile(
        join(root, "config.js"),
        "window.LUMA_CONFIG = {UNSPLASH_ACCESS_KEY: 'never-copy-local'};",
    );
    const environment = { ...process.env };
    delete environment.UNSPLASH_ACCESS_KEY;
    const run = spawnSync(process.execPath, ["--env-file=.env", "tools/build.mjs"], {
        cwd: root,
        env: environment,
        encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    for (const file of PUBLIC_FILES) assert.ok((await readFile(join(root, "dist", file))).length, file);
    const config = await readFile(join(root, "dist/config.js"), "utf8");
    assert.match(config, /"UNSPLASH_ACCESS_KEY":"build-test-key"/);
    assert.doesNotMatch(config, /never-copy-local/);
    for (const file of [".env", "package.json", "tests/api.test.mjs", "config.example.js"]) {
        await assert.rejects(readFile(join(root, "dist", file)), { code: "ENOENT" });
    }
    const clean = spawnSync(process.execPath, ["tools/build.mjs"], {
        cwd: root,
        env: { ...process.env, UNSPLASH_ACCESS_KEY: "" },
        encoding: "utf8",
    });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(await readFile(join(root, "dist/config.js"), "utf8"), /"UNSPLASH_ACCESS_KEY":""/);
});

test("HTML uses modules, accessible live status, and no embedded API credentials", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
    assert.match(html, /<title>Luma/);
    assert.match(html, /id="search-form"/);
    assert.match(html, /src="script.js" type="module"/);
    assert.doesNotMatch(html, /\bon(?:error|load|click)=/);
    assert.match(html, /id="status-panel" role="status" aria-live="polite"/);
    for (const file of [
        "script.js",
        ...PUBLIC_FILES.filter((file) => file.startsWith("src/")),
        "config.example.js",
    ]) {
        const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
        assert.doesNotMatch(content, /UNSPLASH_ACCESS_KEY\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/, file);
    }
});
