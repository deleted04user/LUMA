import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_FILES } from "./files.mjs";

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
const allowed = new Set([...PUBLIC_FILES, "config.js"]);

export function createStaticServer(root) {
    return createServer(async (request, response) => {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "no-store");
        if (!["GET", "HEAD"].includes(request.method)) {
            response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
            return;
        }
        let file;
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            file = pathname === "/" ? "index.html" : pathname.slice(1);
        } catch {
            response.writeHead(400).end("Invalid URL");
            return;
        }
        if (!allowed.has(file)) {
            response.writeHead(404).end("Not found");
            return;
        }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = Object.fromEntries(
        process.argv
            .slice(2)
            .filter((arg) => arg.includes("="))
            .map((arg) => arg.replace(/^--/, "").split("=")),
    );
    const root = fileURLToPath(
        new URL(process.argv.includes("--dist") ? "../dist/" : "../", import.meta.url),
    );
    const host = options.host || "127.0.0.1";
    const port = Number(options.port || process.env.PORT || 8000);
    const server = createStaticServer(root);
    server.on("error", (error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`Luma available at http://${host}:${port}`));
}
