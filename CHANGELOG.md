# Changelog

## Unreleased

- Separate API, search state, rendering, configuration, and settings into testable modules.
- Prevent stale responses from replacing a newer search and retry failed pagination without skipping a page.
- Return structured API errors, validate response data, and restrict download tracking to Unsplash endpoints.
- Fix download URLs with missing/existing query parameters and announce tracking failures.
- Keep key setup and theme switching usable when browser storage is unavailable.
- Preserve an accessible name for the API setup button at mobile widths.
- Add locked development tools, lint/format checks, coverage gates, and automated browser tests.
- Add a static build, a public-file-only dev server, documented environment configuration, and a non-root container.
- Validate fresh installs and builds, tests, dependency audits, browser flows, and the container in CI.
