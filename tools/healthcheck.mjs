import { pathToFileURL } from "node:url";

export async function checkHealth(base, { fetchImpl = globalThis.fetch } = {}) {
    try {
        const response = await fetchImpl(new URL("/healthz", base), {
            signal: AbortSignal.timeout(2000),
            redirect: "error",
        });
        return response.ok && (await response.json())?.status === "ok";
    } catch {
        return false;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (!(await checkHealth(`http://127.0.0.1:${process.env.PORT || 8000}`))) {
        console.error("Luma healthcheck failed.");
        process.exitCode = 1;
    }
}
