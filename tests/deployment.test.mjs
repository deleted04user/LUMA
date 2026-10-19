import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDeployment, validateDeployment } from "../tools/check-deployment.mjs";

test("the deployment base passes the documented security and availability policies", async () => {
    assert.deepEqual(validateDeployment(await loadDeployment()), []);
});

test("deployment policies reject unsafe workload changes and broken service wiring", async () => {
    const original = await loadDeployment();
    const mutations = [
        [
            (resources) =>
                (resources.find((r) => r.kind === "Namespace").metadata.labels[
                    "pod-security.kubernetes.io/enforce"
                ] = "privileged"),
            /restricted Pod Security/,
        ],
        [
            (resources) =>
                (resources.find((r) => r.kind === "Deployment").spec.template.spec.securityContext.runAsUser =
                    0),
            /non-root UID/,
        ],
        [
            (resources) =>
                (resources.find(
                    (r) => r.kind === "Deployment",
                ).spec.template.spec.automountServiceAccountToken = true),
            /API token/,
        ],
        [
            (resources) =>
                (resources.find((r) => r.kind === "Deployment").spec.template.spec.containers[0].image =
                    "luma:latest"),
            /explicit tag/,
        ],
        [
            (resources) =>
                (resources.find(
                    (r) => r.kind === "Deployment",
                ).spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation = true),
            /Privilege escalation/,
        ],
        [
            (resources) =>
                (resources.find(
                    (r) => r.kind === "Deployment",
                ).spec.template.spec.containers[0].securityContext.capabilities.add = ["SYS_ADMIN"]),
            /without adding any/,
        ],
        [
            (resources) =>
                (resources.find(
                    (r) => r.kind === "Deployment",
                ).spec.template.spec.containers[0].readinessProbe.httpGet.path = "/"),
            /readinessProbe/,
        ],
        [
            (resources) =>
                (resources.find(
                    (r) => r.kind === "Deployment",
                ).spec.template.spec.containers[0].resources.limits = {}),
            /CPU and memory limits/,
        ],
        [
            (resources) =>
                (resources.find((r) => r.kind === "Service").spec.selector["app.kubernetes.io/name"] =
                    "other"),
            /selectors/,
        ],
        [
            (resources) => (resources.find((r) => r.kind === "NetworkPolicy").spec.egress = [{}]),
            /outbound network/,
        ],
        [
            (resources) => resources.find((r) => r.kind === "NetworkPolicy").spec.ingress.push({}),
            /only HTTP ingress/,
        ],
    ];
    for (const [mutate, message] of mutations) {
        const changed = structuredClone(original);
        mutate(changed);
        assert.match(validateDeployment(changed).join("\n"), message);
    }
    assert.ok(
        validateDeployment(original.filter((resource) => resource.kind !== "NetworkPolicy")).includes(
            "Missing NetworkPolicy",
        ),
    );
});
