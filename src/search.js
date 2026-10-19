/** @param {string} query */
export function normalizeQuery(query) {
    return query.trim().replace(/\s+/g, " ");
}

/**
 * @param {{fetchPhotos: (query: string, options: import("./types.js").SearchOptions) => Promise<import("./types.js").ApiResult<import("./types.js").SearchData>>, onChange: (state: import("./types.js").SearchState) => void}} options
 */
export function createSearchController({ fetchPhotos, onChange }) {
    /** @type {import("./types.js").SearchState} */
    let state = {
        query: "",
        page: 0,
        totalPages: 0,
        total: 0,
        photos: [],
        orientation: "",
        orderBy: "relevant",
        loading: false,
        append: false,
        error: null,
    };
    /** @type {AbortController | undefined} */
    let controller;
    let revision = 0;
    /** @param {Partial<import("./types.js").SearchState>} changes */
    const update = (changes) => {
        state = { ...state, ...changes };
        onChange({ ...state });
    };

    /** @param {number} page @param {boolean} append */
    async function requestPage(page, append) {
        controller?.abort();
        controller = new AbortController();
        const currentRevision = ++revision;
        update({ loading: true, append, error: null });
        const result = await fetchPhotos(state.query, {
            page,
            orientation: state.orientation,
            orderBy: state.orderBy,
            signal: controller.signal,
        });
        // Abort is advisory: a cached response may still resolve after the next search.
        if (revision !== currentRevision) return;
        if (!result.ok) {
            update({ loading: false, error: result.error });
            return;
        }
        update({
            loading: false,
            page,
            totalPages: result.data.total_pages,
            total: result.data.total,
            photos: append ? [...state.photos, ...result.data.results] : result.data.results,
        });
    }

    /** @param {string} query @param {Partial<import("./types.js").SearchFilters>} [filters] */
    function search(query, filters = {}) {
        const cleaned = normalizeQuery(query);
        if (!cleaned) return Promise.resolve(false);
        state = { ...state, ...filters, query: cleaned, page: 0, totalPages: 0, total: 0, photos: [] };
        return requestPage(1, false);
    }

    return {
        getState: () => ({ ...state }),
        search,
        refresh: (filters = {}) => search(state.query, filters),
        loadMore() {
            if (state.loading || !state.page || state.page >= state.totalPages) return Promise.resolve(false);
            return requestPage(state.page + 1, true);
        },
    };
}
