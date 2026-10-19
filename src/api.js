/**
 * @typedef {import("./types.js").ApiError} ApiError
 * @typedef {import("./types.js").ErrorCode} ErrorCode
 * @typedef {import("./types.js").SearchData} SearchData
 * @typedef {import("./types.js").Photo} Photo
 */
/**
 * @template T
 * @typedef {import("./types.js").ApiResult<T>} ApiResult
 */
/** @param {ErrorCode} code @param {string} message @returns {{ok: false, error: ApiError}} */
const failure = (code, message) => ({ ok: false, error: { code, message } });

/** @param {string} url @param {{accessKey: string, signal?: AbortSignal, fetchImpl: typeof fetch}} options @returns {Promise<ApiResult<unknown>>} */
async function request(url, { accessKey, signal, fetchImpl }) {
    if (!accessKey?.trim()) return failure("missing-key", "Add your Unsplash Access Key in API setup.");
    try {
        const response = await fetchImpl(url, {
            headers: { Authorization: `Client-ID ${accessKey.trim()}`, "Accept-Version": "v1" },
            signal,
            redirect: "error",
        });
        if (response.status === 401) {
            return failure("unauthorized", "That Access Key was not accepted. Check it in API setup.");
        }
        if (response.status === 403 || response.status === 429) {
            return failure("rate-limit", "The API rate limit has been reached. Try again later.");
        }
        if (!response.ok)
            return failure("http", "Unsplash could not complete this request. Please try again.");
        try {
            return { ok: true, data: await response.json() };
        } catch {
            return failure("invalid-response", "Unsplash returned an unreadable response. Please try again.");
        }
    } catch (error) {
        return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
            ? failure("aborted", "The request was cancelled.")
            : failure("network", "Could not reach Unsplash. Check your connection and try again.");
    }
}

/** @param {unknown} value @returns {value is Photo} */
function isPhoto(value) {
    const photo = /** @type {Photo | null} */ (value);
    return (
        !!photo &&
        typeof photo.urls?.small === "string" &&
        typeof photo.urls?.regular === "string" &&
        typeof photo.user?.name === "string" &&
        typeof photo.user?.links?.html === "string" &&
        typeof photo.user?.profile_image?.small === "string" &&
        typeof photo.links?.html === "string" &&
        typeof photo.links?.download === "string" &&
        typeof photo.links?.download_location === "string" &&
        (photo.id === undefined || typeof photo.id === "string") &&
        (photo.alt_description === null ||
            photo.alt_description === undefined ||
            typeof photo.alt_description === "string") &&
        (photo.description === null ||
            photo.description === undefined ||
            typeof photo.description === "string") &&
        Number.isFinite(photo.width) &&
        photo.width > 0 &&
        Number.isFinite(photo.height) &&
        photo.height > 0
    );
}

/** @param {string} query @param {import("./types.js").SearchOptions} [options] @returns {Promise<ApiResult<SearchData>>} */
export async function fetchPhotos(
    query,
    {
        accessKey = "",
        page = 1,
        orientation = "",
        orderBy = "relevant",
        signal,
        fetchImpl = globalThis.fetch,
    } = {},
) {
    const params = new URLSearchParams({
        query,
        page: String(page),
        per_page: "12",
        order_by: orderBy,
        content_filter: "high",
    });
    if (orientation) params.set("orientation", orientation);
    const result = await request(`https://api.unsplash.com/search/photos?${params}`, {
        accessKey,
        signal,
        fetchImpl,
    });
    if (!result.ok) return result;
    const data = /** @type {SearchData | null} */ (result.data);
    if (
        !Array.isArray(data?.results) ||
        !data.results.every(isPhoto) ||
        !Number.isInteger(data.total_pages) ||
        data.total_pages < 0 ||
        !Number.isInteger(data.total) ||
        data.total < 0
    ) {
        return failure("invalid-response", "Unsplash returned incomplete photo data. Please try again.");
    }
    return { ok: true, data };
}

/** @param {string} downloadLocation @param {{accessKey?: string, fetchImpl?: typeof fetch}} [options] @returns {Promise<ApiResult<unknown>>} */
export async function trackDownload(downloadLocation, { accessKey = "", fetchImpl = globalThis.fetch } = {}) {
    try {
        const url = new URL(downloadLocation);
        if (
            url.origin !== "https://api.unsplash.com" ||
            url.username ||
            url.password ||
            !/^\/photos\/[^/]+\/download$/.test(url.pathname)
        ) {
            return failure("invalid-url", "The download tracking URL is not an Unsplash endpoint.");
        }
        return request(url.toString(), { accessKey, fetchImpl });
    } catch {
        return failure("invalid-url", "The download tracking URL is invalid.");
    }
}
