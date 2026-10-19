export function photo(id = "photo-1", overrides = {}) {
    return {
        id,
        width: 1200,
        height: 800,
        alt_description: "Mountain at sunrise",
        description: "A mountain",
        urls: { small: "https://images.unsplash.com/small", regular: "https://images.unsplash.com/regular" },
        user: {
            name: "Ada Photographer",
            links: { html: "https://unsplash.com/@ada" },
            profile_image: { small: "https://images.unsplash.com/avatar" },
        },
        links: {
            html: `https://unsplash.com/photos/${id}`,
            download: `https://unsplash.com/photos/${id}/download`,
            download_location: `https://api.unsplash.com/photos/${id}/download`,
        },
        ...overrides,
    };
}

export const success = (results = [photo()], totalPages = 2) => ({
    ok: true,
    data: { results, total_pages: totalPages, total: 24 },
});

export function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
