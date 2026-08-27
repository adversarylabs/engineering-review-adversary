import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareOperationalTargetHints } from "../src/operational-targets.ts";

const deployment = `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - command:
        - /resolver
        image: registry.example/resolver:v1
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
`;

const dockerfile = `FROM golang:1.24 AS builder
WORKDIR /workspace
COPY ./resolver/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o resolver cmd/main.go
FROM scratch
COPY --from=builder /workspace/resolver .
ENTRYPOINT ["/resolver"]
`;

async function fixture(template = deployment, build = dockerfile) {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-target-hints-"));
  await mkdir(join(root, "charts", "elasti", "templates"), { recursive: true });
  await mkdir(join(root, "resolver", "cmd"), { recursive: true });
  await writeFile(join(root, "charts", "elasti", "templates", "deployment.yaml"), template);
  await writeFile(join(root, "resolver", "Dockerfile"), build);
  await writeFile(join(root, "resolver", "cmd", "main.go"), `package main
import "net/http"
func main() {
  mux := http.NewServeMux()
  mux.Handle("/metrics", metricsHandler())
}
`);
  return root;
}

function context(root: string) {
  return {
    repoPath: root,
    change: {
      scanMode: "changed" as const,
      changedFiles: ["charts/elasti/templates/deployment.yaml"],
      worktree: false,
    },
    async rglob(pattern: string): Promise<string[]> {
      return pattern.includes("Dockerfile") ? ["resolver/Dockerfile"] : [];
    },
  };
}

test("prepares exact chart, build, and entrypoint candidates without declaring a finding", async () => {
  const root = await fixture();
  assert.deepEqual(await prepareOperationalTargetHints(context(root)), [{
    changedTemplate: "charts/elasti/templates/deployment.yaml",
    containerCommand: "/resolver",
    literalHttpPaths: ["/healthz", "/readyz"],
    missingLiteralHttpPaths: ["/healthz", "/readyz"],
    templateEvidenceLines: [8, 12, 16],
    buildFile: "resolver/Dockerfile",
    buildEvidenceLines: [4, 7],
    entrypoint: "resolver/cmd/main.go",
    routeRegistrationLines: [5],
  }]);
});

test("direct registrations preserve a prepared clean candidate with no missing paths", async () => {
  const root = await fixture();
  await writeFile(join(root, "resolver", "cmd", "main.go"), `package main
import "net/http"
func main() {
  mux := http.NewServeMux()
  mux.HandleFunc("/healthz", health)
  mux.HandleFunc("/readyz", ready)
}
`);
  assert.deepEqual(await prepareOperationalTargetHints(context(root)), [{
    changedTemplate: "charts/elasti/templates/deployment.yaml",
    containerCommand: "/resolver",
    literalHttpPaths: ["/healthz", "/readyz"],
    missingLiteralHttpPaths: [],
    templateEvidenceLines: [8, 12, 16],
    buildFile: "resolver/Dockerfile",
    buildEvidenceLines: [4, 7],
    entrypoint: "resolver/cmd/main.go",
    routeRegistrationLines: [5, 6],
  }]);
});

test("dynamic paths and unproven build ownership fail closed", async () => {
  const dynamicRoot = await fixture(
    deployment
      .replace("/healthz", "{{ .Values.healthPath }}")
      .replace("/readyz", "{{ .Values.readyPath }}"),
  );
  const wrongBuildRoot = await fixture(deployment, dockerfile.replace("-o resolver", "-o worker"));
  assert.deepEqual(await prepareOperationalTargetHints(context(dynamicRoot)), []);
  assert.deepEqual(await prepareOperationalTargetHints(context(wrongBuildRoot)), []);
});
