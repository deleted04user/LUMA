export function normalizeQuery(query) {
    return query.trim().replace(/\s+/g, " ");
}

export function createSearchController({ fetchPhotos, onChange }) {
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
    let controller;
    let revision = 0;
    const update = (changes) => {
        state = { ...state, ...changes };
        onChange({ ...state });
    };

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
