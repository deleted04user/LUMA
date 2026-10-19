import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStaticServer, getServerOptions } from "../tools/serve.mjs";
import { checkHealth } from "../tools/healthcheck.mjs";
import { PUBLIC_FILES } from "../tools/files.mjs";

test("server options document defaults and honor PORT and explicit CLI overrides", () => {
    assert.deepEqual(getServerOptions(), { host: "127.0.0.1", port: 8000, dist: false });
    assert.equal(getServerOptions([], { PORT: "8123" }).port, 8123);
    assert.deepEqual(getServerOptions(["--dist", "--host=0.0.0.0", "--port=0"], { PORT: "8123" }), {
        host: "0.0.0.0",
        port: 0,
        dist: true,
    });
    for (const PORT of ["", "NaN", "-1", "1.5", "65536"])
        assert.throws(() => getServerOptions([], { PORT }), /PORT must be/);
    assert.throws(() => getServerOptions(["--port"]), /Use --dist/);
});

test("readiness detects missing assets and structured logs exclude credentials and query text", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "luma-health-"));
    const logs = [];
    const server = createStaticServer(root, { logger: (entry) => logs.push(entry) });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        assert.equal(dirname(resolve(root)), resolve(tmpdir()));
        assert.ok(basename(root).startsWith("luma-health-"));
        await rm(root, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const unavailable = await fetch(`${base}/healthz`);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: "unavailable" });
    assert.equal(await checkHealth(base), false);
    for (const file of PUBLIC_FILES) {
        await mkdir(dirname(join(root, file)), { recursive: true });
        await writeFile(join(root, file), "public asset");
    }
    assert.equal(await checkHealth(base), true);
    const healthy = await fetch(`${base}/healthz`);
    assert.equal(healthy.status, 200);
    assert.match(healthy.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await healthy.json(), { status: "ok" });
    assert.match(healthy.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(healthy.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(healthy.headers.get("referrer-policy"), "no-referrer");
    assert.match(healthy.headers.get("permissions-policy"), /camera=\(\)/);
    const head = await fetch(`${base}/healthz`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    await fetch(`${base}/?access_key=secret-query`, {
        headers: { Authorization: "Client-ID secret-header" },
    });
    await fetch(`${base}/private-secret-name`);
    assert.ok(logs.some((entry) => entry.resource === "health" && entry.status === 503));
    assert.ok(logs.some((entry) => entry.resource === "index.html" && entry.status === 200));
    assert.ok(logs.every((entry) => entry.event === "http_request" && Number.isFinite(entry.duration_ms)));
    assert.doesNotMatch(JSON.stringify(logs), /secret-query|secret-header|private-secret-name/);
    await rm(join(root, "src/api.js"));
    assert.equal(await checkHealth(base), false);
    await mkdir(join(root, "src/api.js"));
    assert.equal(await checkHealth(base), false);
});

test("healthcheck failures return false for invalid data, redirects, and offline servers", async () => {
    for (const fetchImpl of [
        async () => ({ ok: true, json: async () => ({ status: "unavailable" }) }),
        async () => ({ ok: true, json: async () => null }),
        async () => ({ ok: false }),
        async () => ({
            ok: true,
            json: async () => {
                throw new SyntaxError();
            },
        }),
        async (_, options) => {
            assert.equal(options.redirect, "error");
            throw new TypeError("Offline");
        },
    ])
        assert.equal(await checkHealth("http://localhost:8000", { fetchImpl }), false);
});

test("CLI starts with a custom PORT and reports the actual ephemeral port", async (t) => {
    const child = spawn(process.execPath, ["tools/serve.mjs"], {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, PORT: "0" },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => {
        if (child.exitCode !== null) return;
        return new Promise((resolve) => {
            child.once("close", resolve);
            child.kill();
        });
    });
    const startup = await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error("Server did not start")), 5000);
        child.once("error", reject);
        child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`Server exited: ${code}`));
        });
        child.stdout.on("data", (chunk) => {
            output += chunk;
            if (!output.includes("\n")) return;
            clearTimeout(timer);
            try {
                resolve(JSON.parse(output.split("\n")[0]));
            } catch (error) {
                reject(error);
            }
        });
    });
    assert.equal(startup.event, "server_started");
    assert.ok(startup.port > 0);
    assert.equal((await fetch(`http://127.0.0.1:${startup.port}/`)).status, 200);
});
