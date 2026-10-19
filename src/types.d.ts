export interface LumaConfig {
    UNSPLASH_ACCESS_KEY?: unknown;
}

export interface Photo {
    id?: string;
    width: number;
    height: number;
    alt_description?: string | null;
    description?: string | null;
    urls: { small: string; regular: string };
    user: {
        name: string;
        links: { html: string };
        profile_image: { small: string };
    };
    links: { html: string; download: string; download_location: string };
}

export type ErrorCode =
    | "missing-key"
    | "unauthorized"
    | "rate-limit"
    | "http"
    | "invalid-response"
    | "aborted"
    | "network"
    | "invalid-url";
export interface ApiError {
    code: ErrorCode;
    message: string;
}
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export interface SearchData {
    results: Photo[];
    total_pages: number;
    total: number;
}
export interface SearchOptions {
    accessKey?: string;
    page?: number;
    orientation?: string;
    orderBy?: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
}
export interface SearchState {
    query: string;
    page: number;
    totalPages: number;
    total: number;
    photos: Photo[];
    orientation: string;
    orderBy: string;
    loading: boolean;
    append: boolean;
    error: ApiError | null;
}
export type SearchFilters = Pick<SearchState, "orientation" | "orderBy">;
export type DownloadHandler = (url: string) => void | Promise<void>;
export type AppElements = ReturnType<typeof import("./dom.js").getElements>;

declare global {
    interface Window {
        LUMA_CONFIG?: LumaConfig;
    }
}
