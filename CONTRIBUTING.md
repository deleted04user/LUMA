# Contributing

Use Node.js 24.15+ in the 24 LTS series, or Node.js 26+. Start from a clean clone and install the pinned tools with `npm ci`.

1. Create a branch for one concrete fix or feature.
2. Keep API behavior in `src/api.js`, state changes in `src/search.js`, and DOM rendering in `src/render.js`. Use `script.js` to connect the modules.
3. Add a test that reproduces the problem or proves the new behavior. Use Node's built-in test runner for logic, jsdom for rendering/settings, and Playwright for user flows.
4. Run `npm run format`, `npm run check`, `npm run build`, and `npm run test:e2e`. First install the test browsers with `npx playwright install chromium firefox` (add `--with-deps` on Linux when needed).
5. Update setup instructions or `CHANGELOG.md` when behavior changes. Describe the trigger, resulting behavior, and validation in the pull request.
6. Commit each coherent change together with its tests. Use your own identity, retain genuine history, and avoid unrelated formatting or refactors.

Never commit `config.js`, `.env`, real keys, generated `dist/`, test reports, or `node_modules/`. Tests use mock responses and must not call Unsplash. Runtime production code remains framework-free; new development dependencies must be justified, pinned, and accompanied by a lockfile update.

`npm run check` enforces linting, strict JSDoc type checking, formatting, app-module coverage, and deployment policies. `npm run typecheck` checks the browser modules and entry script without emitting or converting JavaScript. Update `src/types.d.ts` and the compile-time contract tests when public types change. Do not lower coverage thresholds to accommodate untested behavior.

Run `docker compose config --quiet` for Compose edits and `kubectl kustomize k8s/base` for Kubernetes edits. Add a negative policy test when a deployment safeguard changes. Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) for running the complete deployment tests. CI checks clean installs/builds on Linux and Windows, all browser projects, dependency audits, restricted Compose startup, and a real Kubernetes rollout in an ephemeral kind cluster. Review CI failures before merging.

Dependabot checks the npm toolchain, GitHub Actions, and Docker images weekly. Review these updates with the same checks as any other change; updates are not merged automatically.
