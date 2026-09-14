"use strict";

const STORAGE = {
    accessKey: "luma-unsplash-access-key",
    theme: "luma-theme",
};

const state = {
    query: "",
    page: 1,
    totalPages: 0,
    orientation: "",
    orderBy: "relevant",
    loading: false,
    controller: null,
};

const elements = {
    document: document.documentElement,
    form: document.getElementById("search-form"),
    input: document.getElementById("search-box"),
    gallery: document.getElementById("search-result"),
    status: document.getElementById("status-panel"),
    resultsTitle: document.getElementById("results-title"),
    filters: document.getElementById("filters"),
    orientation: document.getElementById("orientation-filter"),
    sort: document.getElementById("sort-filter"),
    loadMore: document.getElementById("show-more-btn"),
    themeToggle: document.getElementById("theme-toggle"),
    settingsButton: document.getElementById("settings-button"),
    settingsDialog: document.getElementById("settings-dialog"),
    settingsForm: document.getElementById("settings-form"),
    accessKey: document.getElementById("access-key"),
    clearKey: document.getElementById("clear-key"),
    toast: document.getElementById("toast"),
};

function getAccessKey() {
    return window.LUMA_CONFIG?.UNSPLASH_ACCESS_KEY?.trim()
        || localStorage.getItem(STORAGE.accessKey)?.trim()
        || "";
}

function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    elements.document.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE.theme, nextTheme);
    elements.themeToggle.setAttribute(
        "aria-label",
        nextTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
}

function initializeTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(saved || preferred);
}

let toastTimer;
function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function showSettings() {
    elements.accessKey.value = getAccessKey();
    elements.settingsDialog.showModal();
    window.setTimeout(() => elements.accessKey.focus(), 50);
}

function renderStatus(title, message, actionLabel = "") {
    elements.status.replaceChildren();

    const art = document.createElement("div");
    art.className = "status-art";
    art.setAttribute("aria-hidden", "true");
    art.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

    const heading = document.createElement("h3");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = message;
    elements.status.append(art, heading, body);

    if (actionLabel) {
        const action = document.createElement("button");
        action.className = "secondary-button";
        action.type = "button";
        action.textContent = actionLabel;
        action.addEventListener("click", showSettings);
        elements.status.append(action);
    }

    elements.status.hidden = false;
}

function renderSkeletons() {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 8; index += 1) {
        const skeleton = document.createElement("div");
        skeleton.className = "skeleton";
        skeleton.setAttribute("aria-hidden", "true");
        fragment.append(skeleton);
    }
    elements.gallery.replaceChildren(fragment);
}

function icon(name) {
    const paths = {
        open: '<path d="M14 5h5v5"></path><path d="M10 14 19 5"></path><path d="M19 13v6H5V5h6"></path>',
        download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function withReferral(url) {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", "luma_search");
    parsed.searchParams.set("utm_medium", "referral");
    return parsed.toString();
}

async function trackDownload(downloadLocation) {
    const accessKey = getAccessKey();
    if (!accessKey || !downloadLocation) return;

    try {
        await fetch(downloadLocation, {
            headers: { Authorization: `Client-ID ${accessKey}` },
        });
    } catch {
        // The user can still open the photo if download tracking is unavailable.
    }
}

function createPhotoCard(photo) {
    const article = document.createElement("article");
    article.className = "photo-card";

    const image = document.createElement("img");
    image.src = photo.urls.small;
    image.srcset = `${photo.urls.small} 400w, ${photo.urls.regular} 1080w`;
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
    avatar.src = photo.user.profile_image.small;
    avatar.alt = "";
    avatar.loading = "lazy";
    avatar.width = 32;
    avatar.height = 32;
    const name = document.createElement("span");
    name.textContent = photo.user.name;
    photographer.append(avatar, name);

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const openLink = document.createElement("a");
    openLink.className = "photo-action";
    openLink.href = withReferral(photo.links.html);
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.setAttribute("aria-label", "View photo on Unsplash");
    openLink.innerHTML = icon("open");

    const downloadLink = document.createElement("a");
    downloadLink.className = "photo-action";
    downloadLink.href = `${photo.links.download}&force=true`;
    downloadLink.target = "_blank";
    downloadLink.rel = "noopener noreferrer";
    downloadLink.setAttribute("aria-label", "Download photo from Unsplash");
    downloadLink.innerHTML = icon("download");
    downloadLink.addEventListener("click", () => trackDownload(photo.links.download_location));

    actions.append(openLink, downloadLink);
    overlay.append(photographer, actions);
    article.append(image, overlay);
    return article;
}

function appendPhotos(photos) {
    const fragment = document.createDocumentFragment();
    photos.forEach((photo) => fragment.append(createPhotoCard(photo)));
    elements.gallery.append(fragment);
}

function setLoading(isLoading, append = false) {
    state.loading = isLoading;
    elements.loadMore.disabled = isLoading;
    elements.loadMore.setAttribute("aria-busy", String(isLoading));
    elements.loadMore.querySelector("span").textContent = isLoading && append
        ? "Loading photos…"
        : "Load more photos";
}

async function searchImages({ append = false } = {}) {
    const accessKey = getAccessKey();
    if (!accessKey) {
        renderStatus("Connect Unsplash to search", "Add your free Unsplash Access Key once to enable live results.", "Add Access Key");
        showSettings();
        return;
    }

    if (!state.query) return;

    state.controller?.abort();
    state.controller = new AbortController();
    const controller = state.controller;
    setLoading(true, append);

    if (!append) {
        elements.status.hidden = true;
        elements.loadMore.hidden = true;
        renderSkeletons();
    }

    const params = new URLSearchParams({
        query: state.query,
        page: String(state.page),
        per_page: "12",
        order_by: state.orderBy,
        content_filter: "high",
    });
    if (state.orientation) params.set("orientation", state.orientation);

    try {
        const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
            headers: {
                Authorization: `Client-ID ${accessKey}`,
                "Accept-Version": "v1",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("That Access Key was not accepted. Check it in API setup.");
            if (response.status === 403) throw new Error("The API rate limit has been reached. Try again later.");
            throw new Error("Unsplash could not complete this search. Please try again.");
        }

        const data = await response.json();
        state.totalPages = data.total_pages;

        if (!append) elements.gallery.replaceChildren();

        if (!data.results.length && state.page === 1) {
            elements.gallery.replaceChildren();
            renderStatus("No photos found", `Try a broader search than “${state.query}”.`);
            elements.resultsTitle.textContent = "No matches this time";
            elements.filters.hidden = false;
            return;
        }

        appendPhotos(data.results);
        elements.resultsTitle.textContent = `${data.total.toLocaleString()} results for “${state.query}”`;
        elements.filters.hidden = false;
        elements.loadMore.hidden = state.page >= state.totalPages;
    } catch (error) {
        if (error.name === "AbortError") return;
        if (!append) elements.gallery.replaceChildren();
        renderStatus("Search unavailable", error.message, error.message.includes("Access Key") ? "Check Access Key" : "");
        elements.loadMore.hidden = true;
    } finally {
        if (state.controller === controller) setLoading(false, append);
    }
}

function startSearch(query) {
    const cleanedQuery = query.trim().replace(/\s+/g, " ");
    if (!cleanedQuery) {
        elements.input.focus();
        showToast("Enter something to search for.");
        return;
    }

    state.query = cleanedQuery;
    state.page = 1;
    elements.input.value = cleanedQuery;
    searchImages();
}

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    startSearch(elements.input.value);
});

document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => startSearch(button.dataset.query));
});

elements.loadMore.addEventListener("click", () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    searchImages({ append: true });
});

elements.orientation.addEventListener("change", () => {
    state.orientation = elements.orientation.value;
    state.page = 1;
    searchImages();
});

elements.sort.addEventListener("change", () => {
    state.orderBy = elements.sort.value;
    state.page = 1;
    searchImages();
});

elements.themeToggle.addEventListener("click", () => {
    setTheme(elements.document.dataset.theme === "dark" ? "light" : "dark");
});

elements.settingsButton.addEventListener("click", showSettings);

elements.settingsForm.addEventListener("submit", (event) => {
    const submitterValue = event.submitter?.value;
    if (submitterValue !== "save") return;

    event.preventDefault();
    const key = elements.accessKey.value.trim();
    if (!key) {
        showToast("Enter a valid Unsplash Access Key.");
        elements.accessKey.focus();
        return;
    }

    localStorage.setItem(STORAGE.accessKey, key);
    elements.settingsDialog.close();
    showToast("Unsplash is connected.");
    if (state.query) searchImages();
});

elements.clearKey.addEventListener("click", () => {
    localStorage.removeItem(STORAGE.accessKey);
    elements.accessKey.value = "";
    showToast("Saved Access Key removed.");
});

elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});

initializeTheme();
