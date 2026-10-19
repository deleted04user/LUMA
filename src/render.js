/** @param {string} url */
function unsplashUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.origin === "https://unsplash.com" && !parsed.username && !parsed.password) return parsed;
    } catch {
        return new URL("https://unsplash.com/");
    }
    return new URL("https://unsplash.com/");
}

/** @param {string} url */
export function withReferral(url) {
    const parsed = unsplashUrl(url);
    parsed.searchParams.set("utm_source", "luma_search");
    parsed.searchParams.set("utm_medium", "referral");
    return parsed.toString();
}

/** @param {string} url */
function imageUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : "";
    } catch {
        return "";
    }
}

/** @param {"open" | "download"} name */
function icon(name) {
    const paths = {
        open: '<path d="M14 5h5v5"></path><path d="M10 14 19 5"></path><path d="M19 13v6H5V5h6"></path>',
        download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

/** @param {import("./types.js").Photo} photo @param {{document?: Document, onDownload?: import("./types.js").DownloadHandler}} [options] */
export function createPhotoCard(photo, { document = globalThis.document, onDownload = () => {} } = {}) {
    const article = document.createElement("article");
    article.className = "photo-card";
    const image = document.createElement("img");
    const small = imageUrl(photo.urls.small);
    const regular = imageUrl(photo.urls.regular);
    image.src = small;
    image.srcset = small && regular ? `${small} 400w, ${regular} 1080w` : "";
    image.sizes = "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw";
    image.alt = photo.alt_description || photo.description || `Photograph by ${photo.user.name}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = photo.width;
    image.height = photo.height;
    const overlay = document.createElement("div");
    overlay.className = "photo-overlay";
    const photographer = document.createElement("a");
    photographer.className = "photographer";
    photographer.href = withReferral(photo.user.links.html);
    photographer.target = "_blank";
    photographer.rel = "noopener noreferrer";
    photographer.setAttribute("aria-label", `View ${photo.user.name} on Unsplash`);
    const avatar = document.createElement("img");
    avatar.src = imageUrl(photo.user.profile_image.small);
    avatar.alt = "";
    avatar.loading = "lazy";
    avatar.width = 32;
    avatar.height = 32;
    const name = document.createElement("span");
    name.textContent = photo.user.name;
    photographer.append(avatar, name);
    const actions = document.createElement("div");
    actions.className = "photo-actions";
    /** @type {["open" | "download", string][]} */
    const links = [
        ["open", "View photo on Unsplash"],
        ["download", "Download photo from Unsplash"],
    ];
    for (const [action, label] of links) {
        const link = document.createElement("a");
        link.className = "photo-action";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", label);
        link.innerHTML = icon(action);
        if (action === "open") link.href = withReferral(photo.links.html);
        else {
            const download = unsplashUrl(photo.links.download);
            download.searchParams.set("force", "true");
            link.href = download.toString();
            link.addEventListener("click", () => onDownload(photo.links.download_location));
        }
        actions.append(link);
    }
    overlay.append(photographer, actions);
    article.append(image, overlay);
    return article;
}

/** @param {HTMLElement} container @param {string} title @param {string} message @param {{actionLabel?: string, onAction?: () => void}} [options] */
export function renderStatus(container, title, message, { actionLabel = "", onAction } = {}) {
    const document = container.ownerDocument;
    const art = document.createElement("div");
    art.className = "status-art";
    art.setAttribute("aria-hidden", "true");
    art.append(...Array.from({ length: 3 }, () => document.createElement("span")));
    const heading = document.createElement("h3");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = message;
    container.replaceChildren(art, heading, body);
    if (actionLabel && onAction) {
        const action = document.createElement("button");
        action.className = "secondary-button";
        action.type = "button";
        action.textContent = actionLabel;
        action.addEventListener("click", onAction);
        container.append(action);
    }
    container.hidden = false;
}

/** @param {HTMLElement} gallery */
export function renderSkeletons(gallery) {
    const document = gallery.ownerDocument;
    gallery.replaceChildren(
        ...Array.from({ length: 8 }, () => {
            const skeleton = document.createElement("div");
            skeleton.className = "skeleton";
            skeleton.setAttribute("aria-hidden", "true");
            return skeleton;
        }),
    );
}

/** @param {import("./types.js").AppElements} elements @param {{onSettings: () => void, onDownload: import("./types.js").DownloadHandler}} handlers */
export function createRenderer(elements, { onSettings, onDownload }) {
    /** @type {import("./types.js").Photo[] | undefined} */
    let previousPhotos;
    /** @param {import("./types.js").SearchState} state */
    return (state) => {
        const { gallery, status, loadMore, resultsTitle, filters } = elements;
        gallery.setAttribute("aria-busy", String(state.loading));
        loadMore.disabled = state.loading;
        loadMore.setAttribute("aria-busy", String(state.loading));
        elements.loadMoreLabel.textContent =
            state.loading && state.append ? "Loading photos…" : "Load more photos";
        loadMore.hidden = !state.page || state.page >= state.totalPages;
        status.hidden = true;
        if (state.loading) {
            if (!state.append) {
                renderSkeletons(gallery);
                previousPhotos = undefined;
                resultsTitle.textContent = `Searching for “${state.query}”…`;
            }
            return;
        }
        if (previousPhotos !== state.photos) {
            gallery.replaceChildren(
                ...state.photos.map((photo) =>
                    createPhotoCard(photo, {
                        document: gallery.ownerDocument,
                        onDownload,
                    }),
                ),
            );
            previousPhotos = state.photos;
        }
        filters.hidden = false;
        if (state.error) {
            const needsKey = ["missing-key", "unauthorized"].includes(state.error.code);
            renderStatus(
                status,
                needsKey ? "Connect Unsplash to search" : "Search unavailable",
                state.error.message,
                {
                    actionLabel: needsKey ? "Check Access Key" : "",
                    onAction: onSettings,
                },
            );
            if (!state.photos.length) resultsTitle.textContent = "Search unavailable";
        } else if (!state.photos.length) {
            renderStatus(status, "No photos found", `Try a broader search than “${state.query}”.`);
            resultsTitle.textContent = "No matches this time";
        } else {
            resultsTitle.textContent = `${state.total.toLocaleString()} results for “${state.query}”`;
        }
    };
}
