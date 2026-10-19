# Deployment and operations

LUMA is a frontend static site. Its optional Node server delivers public assets; photo search runs in the visitor's browser and calls Unsplash directly. No database or application backend is required. Choose a static host, Docker Compose, or the Kubernetes example below.

## Static hosting

Run `npm ci && npm run check && npm run build`, then publish the contents of `dist/` to your static host. The build has no runtime npm dependencies. Configure HTTP security headers in that host separately; the Node server headers described below do not configure GitHub Pages or other hosts.

The default build asks visitors for their own Access Key. To embed a public client identifier, set `UNSPLASH_ACCESS_KEY` when building or use the ignored `.env` file. Never use an Unsplash Secret Key. Local `config.js` is excluded from builds, and `.env` and local config are excluded from Docker's build context. Browser-local setup works in every deployment option.

## One-command Compose startup

With Docker and Compose running:

```sh
docker compose up --build --wait
```

Open `http://127.0.0.1:8000`. The command builds the site, starts its only service, and waits for health checks. No key is needed to start it; live search needs a visitor-supplied key. Stop it with `docker compose down`.

Compose publishes only on localhost. Change the host port with a shell `PORT` value or `PORT=8123` in `.env`; the server inside the container continues listening on 8000. Compose reads `.env` for interpolation; `npm start` and `npm run preview` read `PORT` from their process environment instead.

The container runs as UID 1000 with a read-only filesystem, all Linux capabilities dropped, no privilege escalation, and limits on CPU, memory, and processes. It has no persistent data or writable volumes. For public hosting, place your existing HTTPS reverse proxy in front of the service and configure its hostname and certificate there.

## Health and logs

`GET /healthz` returns `200 {"status":"ok"}` only when every required public asset is a readable regular file. Missing or invalid assets return `503 {"status":"unavailable"}`. `HEAD` has the same status without a response body. This checks the static deployment, not Unsplash availability or the validity of a visitor's key.

```sh
docker compose exec -T luma node tools/healthcheck.mjs
docker compose logs --follow luma
```

The healthcheck command exits nonzero on unavailable assets, bad responses, redirects, timeouts, or connection failures. Docker and Kubernetes use it or the same HTTP endpoint for readiness.

The server emits one JSON startup/error record and structured HTTP records with method, public asset/category, response status, and duration in milliseconds. It excludes query strings, private paths, headers, request bodies, and credentials. The frontend communicates failures through structured API results and accessible recovery states; it does not send user searches to an analytics service.

The Node server sets a restrictive Content Security Policy, blocks framing, disables camera/microphone/geolocation, and sends no referrers. Script/style resources must be same-origin; images are limited to local assets and Unsplash image hosts; connections are limited to the Unsplash API and the image CDN preconnect. Inline event handlers are not used. Update the policy and tests together if new resource hosts are added.

## Local Kubernetes deployment

Requirements: Docker, [kind](https://kind.sigs.k8s.io/docs/user/quick-start/), and a compatible [kubectl](https://kubernetes.io/docs/tasks/tools/). CI tests kind 0.33.0 with Kubernetes 1.36.4.

```sh
docker build -t luma:local .
kind create cluster --name luma
kind load docker-image luma:local --name luma
kubectl apply -f k8s/base/namespace.yaml
kubectl apply --dry-run=server --validate=strict -k k8s/base
kubectl apply -k k8s/base
kubectl -n luma rollout status deployment/luma --timeout=120s
kubectl -n luma port-forward service/luma 8080:80
```

Open `http://127.0.0.1:8080`. The final command stays running while you use the app. After stopping the forward, delete this local test cluster with `kind delete cluster --name luma`.

The Kustomize base creates a dedicated `luma` namespace, a two-replica Deployment, an internal ClusterIP Service, and a NetworkPolicy. Pods run as non-root with the runtime seccomp profile, read-only filesystems, no API token mounts, no privilege escalation, and no capabilities. Startup/readiness/liveness probes use `/healthz`. Resource requests are 50m CPU/64Mi memory per replica; limits are 500m CPU/128Mi memory. Rolling updates keep both desired replicas available and have a bounded progress deadline.

The NetworkPolicy permits HTTP ingress on 8000 and denies egress. Server-side egress is unnecessary because the visitor's browser calls Unsplash. Enforcement requires a NetworkPolicy-capable CNI. The default kind network does not enforce NetworkPolicy; CI tests API validation, policies, workload rollout, readiness, and service HTTP traffic, not network isolation enforcement.

## Existing Kubernetes clusters

Build and push the image to your own registry, then use a Kustomize overlay that references `k8s/base` and replaces `luma:local` with your immutable registry digest. The local image tag is intended for kind and is not a published image. Use a dedicated namespace; review the restricted Pod Security labels against your cluster's policies before applying. Add your existing ingress/TLS configuration separately. No cluster or cloud account is created automatically for production.

Monitor rollout with `kubectl -n luma rollout status deployment/luma`. Inspect probes and events with `kubectl -n luma describe pods`, and inspect request logs with `kubectl -n luma logs deployment/luma --all-pods=true`. Roll back a failed application update with `kubectl -n luma rollout undo deployment/luma`, then confirm readiness again. `kubectl delete -k k8s/base` removes the app resources and its dedicated namespace, including anything else placed there.

## Validation

`npm run deployment:check` enforces the deployment's security, resource, probe, and service-wiring policies. Regression tests deliberately introduce unsafe changes to ensure the gate rejects them. `kubectl kustomize k8s/base` validates rendering locally. CI additionally creates a temporary kind cluster, performs strict server-side schema validation, loads the built image, waits for two ready replicas, tests health and service traffic, and removes the cluster. Compose is built and exercised in a separate CI job.
