import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_FILES } from "./files.mjs";

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
const allowed = new Set([...PUBLIC_FILES, "config.js"]);

export function createStaticServer(root, { logger = () => {} } = {}) {
    return createServer(async (request, response) => {
        const started = performance.now();
        let resource = "not-found";
        response.once("finish", () =>
            logger({
                event: "http_request",
                method: request.method,
                resource,
                status: response.statusCode,
                duration_ms: Number((performance.now() - started).toFixed(2)),
            }),
        );
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader(
            "Content-Security-Policy",
            [
                "default-src 'none'",
                "base-uri 'none'",
                "frame-ancestors 'none'",
                "form-action 'self'",
                "script-src 'self'",
                "style-src 'self'",
                "img-src 'self' https://images.unsplash.com https://plus.unsplash.com",
                "connect-src https://api.unsplash.com https://images.unsplash.com",
            ].join("; "),
        );
        if (!["GET", "HEAD"].includes(request.method)) {
            resource = "method-not-allowed";
            response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
            return;
        }
        let file;
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            file = pathname === "/" ? "index.html" : pathname.slice(1);
        } catch {
            resource = "invalid-url";
            response.writeHead(400).end("Invalid URL");
            return;
        }
        if (file === "healthz") {
            resource = "health";
            let ready = true;
            try {
                await Promise.all(
                    PUBLIC_FILES.map(async (asset) => {
                        const path = join(root, asset);
                        await access(path, constants.R_OK);
                        if (!(await stat(path)).isFile()) throw new Error("Public asset is not a file.");
                    }),
                );
            } catch {
                ready = false;
            }
            const body = JSON.stringify({ status: ready ? "ok" : "unavailable" });
            response.writeHead(ready ? 200 : 503, {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            });
            response.end(request.method === "HEAD" ? undefined : body);
            return;
        }
        if (!allowed.has(file)) {
            response.writeHead(404).end("Not found");
            return;
        }
        resource = file;
        try {
            let body;
            try {
                body = await readFile(join(root, file));
            } catch (error) {
                if (file !== "config.js" || error.code !== "ENOENT") throw error;
                body = Buffer.from("window.LUMA_CONFIG = {};\n");
            }
            response.writeHead(200, {
                "Content-Type": `${types[extname(file)]}; charset=utf-8`,
                "Content-Length": body.length,
            });
            response.end(request.method === "HEAD" ? undefined : body);
        } catch (error) {
            response.writeHead(error.code === "ENOENT" ? 404 : 500).end("File unavailable");
        }
    });
}

export function getServerOptions(args = [], environment = {}) {
    const options = {};
    for (const argument of args) {
        if (argument === "--dist") continue;
        const match = /^--(host|port)=(.+)$/.exec(argument);
        if (!match) throw new Error("Use --dist, --host=ADDRESS, or --port=NUMBER.");
        options[match[1]] = match[2];
    }
    const rawPort = options.port ?? environment.PORT ?? "8000";
    if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535)
        throw new Error("PORT must be an integer from 0 to 65535.");
    return { host: options.host || "127.0.0.1", port: Number(rawPort), dist: args.includes("--dist") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const log = (entry) => console.log(JSON.stringify(entry));
    try {
        const { host, port, dist } = getServerOptions(process.argv.slice(2), process.env);
        const root = fileURLToPath(new URL(dist ? "../dist/" : "../", import.meta.url));
        const server = createStaticServer(root, { logger: log });
        server.on("error", (error) => {
            log({ event: "server_error", code: error.code });
            process.exitCode = 1;
        });
        server.listen(port, host, () => log({ event: "server_started", host, port: server.address().port }));
    } catch (error) {
        log({ event: "server_error", message: error.message });
        process.exitCode = 1;
    }
}
