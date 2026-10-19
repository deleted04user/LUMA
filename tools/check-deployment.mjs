import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export async function loadDeployment() {
    const base = new URL("../k8s/base/", import.meta.url);
    const kustomization = parse(await readFile(new URL("kustomization.yaml", base), "utf8"));
    return Promise.all(
        kustomization.resources.map(async (file) => parse(await readFile(new URL(file, base), "utf8"))),
    );
}

export function validateDeployment(resources) {
    const errors = [];
    const require = (condition, message) => {
        if (!condition) errors.push(message);
    };
    const find = (kind) => resources.find((resource) => resource.kind === kind);
    for (const kind of ["Namespace", "Deployment", "Service", "NetworkPolicy"])
        require(find(kind), `Missing ${kind}`);
    if (errors.length) return errors;
    const namespace = find("Namespace");
    const deployment = find("Deployment");
    const service = find("Service");
    const policy = find("NetworkPolicy");
    const pod = deployment.spec?.template?.spec;
    const container = pod?.containers?.[0];
    const label = deployment.spec?.template?.metadata?.labels?.["app.kubernetes.io/name"];
    require(namespace.metadata?.labels?.["pod-security.kubernetes.io/enforce"] ===
        "restricted", "Namespace must enforce restricted Pod Security");
    require(deployment.spec?.replicas >= 2, "Deployment needs at least two replicas");
    require(deployment.spec?.strategy?.rollingUpdate?.maxUnavailable ===
        0, "Rolling updates must preserve availability");
    require(pod?.automountServiceAccountToken === false, "Pod must not mount an API token");
    require(pod?.securityContext?.runAsNonRoot === true &&
        pod.securityContext.runAsUser > 0, "Pod must run as a non-root UID");
    require(pod?.securityContext?.seccompProfile?.type ===
        "RuntimeDefault", "Pod must use the default seccomp profile");
    require(container?.securityContext?.allowPrivilegeEscalation ===
        false, "Privilege escalation must be disabled");
    require(container?.securityContext?.readOnlyRootFilesystem ===
        true, "Container filesystem must be read-only");
    require(container?.securityContext?.capabilities?.drop?.includes("ALL") &&
        !container.securityContext.capabilities.add
            ?.length, "Container must drop all capabilities without adding any");
    require(container?.securityContext?.privileged !== true &&
        !pod?.hostNetwork &&
        !pod?.hostPID &&
        !pod?.hostIPC, "Container must not use privileged or host namespaces");
    require(container?.image?.includes(":") &&
        !container.image.endsWith(":latest"), "Image must have an explicit tag or digest");
    for (const field of ["requests", "limits"]) {
        require(container?.resources?.[field]?.cpu &&
            container.resources[field].memory, `Container needs CPU and memory ${field}`);
    }
    for (const field of ["startupProbe", "readinessProbe", "livenessProbe"]) {
        require(container?.[field]?.httpGet?.path === "/healthz" &&
            container[field].httpGet.port === "http", `${field} must use /healthz on the HTTP port`);
    }
    require(Boolean(label) &&
        deployment.spec?.selector?.matchLabels?.["app.kubernetes.io/name"] === label &&
        service.spec?.selector?.["app.kubernetes.io/name"] ===
            label, "Service and Deployment selectors must match the pod");
    require(service.spec?.type === "ClusterIP" &&
        service.spec.ports?.[0]?.targetPort === "http", "Service must expose only the internal HTTP port");
    require(policy.spec?.podSelector?.matchLabels?.["app.kubernetes.io/name"] ===
        label, "Network policy must select the app");
    require(policy.spec?.policyTypes?.includes("Ingress") &&
        policy.spec.policyTypes.includes("Egress"), "Network policy must govern ingress and egress");
    require(Array.isArray(policy.spec?.egress) &&
        policy.spec.egress.length === 0, "Static server must not have outbound network access");
    require(policy.spec?.ingress?.length === 1 &&
        policy.spec.ingress[0].ports?.length === 1 &&
        policy.spec.ingress[0].ports[0].port === 8000, "Network policy must allow only HTTP ingress");
    return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const errors = validateDeployment(await loadDeployment());
    if (errors.length) {
        console.error(errors.join("\n"));
        process.exitCode = 1;
    } else console.log("Kubernetes deployment policy checks passed.");
}
