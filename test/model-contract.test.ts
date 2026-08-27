import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildModelReviewRequest } from "../src/model-review.ts";
import { SOURCE_PATTERNS } from "../src/discover.ts";
import { ENGINEERING_REVIEW_PROMPT } from "../src/prompt.ts";

test("prompt defines staff-level authority and specialist boundaries", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /zero to four important observations/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Silence is better than speculative feedback/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Do not become a linter/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /security, observability/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /primaryConcern must be a short noun phrase/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /repository tools/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /citationId/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Contract integrity/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Declared operational targets/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Ownership and boundaries/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /One source of truth/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Constraint scope/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Alternate-path semantics/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Progress accounting/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Proportional tools and work/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Lifecycle and authority/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Compatibility and operations/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Change cohesion/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Meaningful validation/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Candidate gate/);
  assert.doesNotMatch(
    ENGINEERING_REVIEW_PROMPT,
    /initConfig|g\.spec|OpenForRead|dest\.append|goroutine|context\.Background/,
  );
});

test("prompt binds declared health paths to a proven local listener surface", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /Required repository traversal for deployment templates/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Do not stop after reading only the template/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /use prepared Dockerfile\/build evidence to identify the repository-built entrypoint/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /If bounded retrieval cannot prove the local binary ownership and complete applicable route surface, stay silent/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Template syntax or functions alone are not a defect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /literal HTTP liveness, readiness, or health path/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /repository-built service/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /deployed binary owns a particular listener and route-registration surface/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /exact path has no reachable registration on that listener/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Cite the declaration, the local binary ownership evidence, and the listener or route surface together/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /image or binary is external or ownership is unresolved/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /path is templated or dynamically derived/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /probe is TCP, gRPC, or exec based/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /framework or platform is proven to provide the endpoint/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /declaration is proven to target another container, sidecar, port, listener, or process not owned by the prepared binary/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /reachable direct route, helper registration, or broader route pattern on the applicable listener/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /complete applicable registration surface/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /documentation, comments, tests, or an unrelated listener is not handler proof/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /absence is never inferred from a partial source view/);
});

test("prompt preserves per-entity constraint semantics", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /collapses differing consumer, listener, tenant, or route policies into one aggregate gate/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /reject an item accepted by at least one applicable entity/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /first selects the applicable entities and evaluates their constraints/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /explicit system-wide invariant/);
});

test("prompt checks explicit conformance against exact normative semantics", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /explicitly claims conformance or migration to a normative versioned contract/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /exact combination, precedence, ordering, fallback, and compatibility semantics/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /prepared specification text or repository-owned contract material/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /concrete mismatch with a reachable effect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /cite both the governing requirement and the implementation branch/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /every configured value and required order are preserved/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /prepared requirement does not govern the changed path/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /wording, naming, or repository layout/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /separate issues for each field/);
});

test("prompt preserves value metadata on alternate paths", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /optimized, vectorized, cached, or specialized paths must preserve the generic path's observable input semantics/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /separates a value from validity, presence, or tombstone metadata/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /reads the value alone when doing so can accept, retain, or count an invalid item/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /input is statically non-nullable/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /earlier step removes invalid items/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /evaluates the value together with its metadata/);
});

test("prompt preserves repeated-use semantics on alternate paths", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /same logical operation more than once in a supported lifecycle/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /repeated invocation of the same logical operation is reachable/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /first alternate-path invocation leaves concrete destination, marker, lease, link, registration, or equivalent state/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /later invocation encounters that state/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /fail, skip required work, or otherwise diverge from the generic path/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Cite the repeated entrypoint, retained state, and conflicting later operation together/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /single use is an established invariant/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /resets or atomically replaces its state before reuse/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /distinct keys or targets/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /demonstrably idempotent or reentrant/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /repeated-use divergence is only assumed/);
});

test("prompt requires production framing validation before tolerant partial decoding", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /decodes serialized, persisted, or externally supplied state/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /assertion disabled in production/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /consumer is proven to ignore or truncate malformed remainder and still return success/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /reachable malformed-input boundary/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /cite both the release-disabled check and the tolerant partial consumer/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /construction is proven trusted/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /production validation already rejects malformed framing/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /consumer exposes or rejects any remainder/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /debug assertion only duplicates a real check/);
});

test("prompt accounts for actual pagination progress", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /advance by actual consumption unless the changed code establishes that every non-final page is full/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /server can return a short non-final page or clamps the requested size/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /next request can skip unseen records/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /follows an opaque server cursor/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /advances by the returned item count/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /fixed-size byte or block ranges/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Combine sibling occurrences into one finding/);
});

test("prompt requires material cost and proven independence for cheap rejections", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /materially expensive resolution, fetch, or allocation that runs before an inexpensive rejection/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /proves the rejecting predicate is independent of both the operation's result and its effects/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /cite both the expensive call and the cheap predicate/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /repeated materially expensive retrieval of the same derived data/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /no intervening mutation or invalidation/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /required canonicalization or side effects/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /either cost or independence is merely assumed/);
});

test("prompt requires proof before treating mutation writes as coalescible", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /material hot-path or scale cost/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /same logical target and current endpoint, subresource, or transaction boundary/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /derive from the same pre-write state/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /one supported atomic operation can express both changes/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /resource version, timestamp, or CAS preserves concurrency/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /distinct side effects, audit, transaction, failure, or retry semantics/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /depends on the first response or refreshed state/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /targets or current boundaries differ/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /combining is merely planned for a future boundary/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /combine capability is assumed/);
});

test("prompt requires cross-file proof for host-destructive integration harnesses", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /directly runnable on a developer or persistent runner host/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /documented or default local entrypoint/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /privileged persistent host mutation/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /same reachable harness controls live services or global workloads/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /no dominating boundary before the first effect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Cite the local entrypoint, the persistent host effect, and the service or global-workload effect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Dockerfile\/image-build effects/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /hosted ephemeral CI runners/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /self-hosted runner label does not prove disposable containment/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /disposable container, VM, chroot, rootfs, or filesystem namespace/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /test-owned temporary storage or mocks/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /inert documentation, fixtures, or uninvoked helpers/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /only mutation without service\/global control/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Never infer host reachability from filenames/);
});

test("prompt binds approval of mutable content to an immutable artifact identity", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /earlier review, validation, or approval is based on mutable content/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /pinned to the approved immutable identity or compared with it before any effect/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /re-resolution window and a reachable wrong-content outcome/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /same immutable object flows through/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /identity mismatch aborts before effects/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /intentionally fresh without relying on the earlier approval/,
  );
});

test("prompt preserves required effects across independent setup failures", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /required disable, unregister, restore, or cleanup effect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /independent operation that can fail or return first/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /failure path skips that required effect/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /concrete contradictory behavior reachable/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Cite the failing predecessor and skipped effect together/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /independent guarded execution, guaranteed cleanup, or a transaction/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /later effect depends on successful setup/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /cleanup or rollback is already guaranteed/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /requirement is inferred only from convention/);
});

test("prompt requires applicable constraints on derived effective values", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /later default, fallback, normalization, or coercion produces the value actually rendered/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /require those same applicable constraints on that effective value/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /derived value can violate the constraint and still reach a real effect/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /transformation provably preserves the accepted domain/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /effective values are revalidated/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /intentionally a caller-presence check such as required/);
});

test("model schema is strict and avoids provider-specific constraint keywords", async () => {
  const text = await readFile(
    new URL("../schemas/engineering-review.model.v1.schema.json", import.meta.url),
    "utf8",
  );
  const schema = JSON.parse(text);

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    "schemaVersion",
    "overall",
    "observations",
    "strengths",
  ]);
  assert.doesNotMatch(text, /"minLength"|"maxLength"|"minItems"|"maxItems"/);
  assert.doesNotMatch(text, /"\$ref"|\$defs/);
  assert.match(text, /"citationId"/);
  assert.doesNotMatch(text, /"sourceId"|"quote"/);
});

test("model request delegates bounded repository retrieval to the SDK", () => {
  const request = buildModelReviewRequest(null, [{
    changedTemplate: "charts/elasti/templates/deployment.yaml",
    containerCommand: "/resolver",
    literalHttpPaths: ["/healthz", "/readyz"],
    missingLiteralHttpPaths: ["/healthz", "/readyz"],
    templateEvidenceLines: [108, 150, 156],
    buildFile: "resolver/Dockerfile",
    buildEvidenceLines: [25, 34],
    entrypoint: "resolver/cmd/main.go",
    routeRegistrationLines: [121, 144, 145],
  }]);
  const input = request.input as Record<string, unknown> & {
    investigationGuide?: {
      declaredOperationalTargets?: string;
      failClosedBoundary?: string;
      preparedCandidates?: Array<{
        changedTemplate?: string;
        buildFile?: string;
        entrypoint?: string;
      }>;
    };
  };

  assert.equal("sources" in input, false);
  assert.match(input.investigationGuide?.declaredOperationalTargets ?? "", /container command\/image/);
  assert.match(input.investigationGuide?.declaredOperationalTargets ?? "", /complete applicable listener\/route-registration surface/);
  assert.match(input.investigationGuide?.failClosedBoundary ?? "", /stay quiet/);
  assert.match(input.investigationGuide?.failClosedBoundary ?? "", /generic Helm rendering/);
  assert.deepEqual(input.investigationGuide?.preparedCandidates, [{
    changedTemplate: "charts/elasti/templates/deployment.yaml",
    containerCommand: "/resolver",
    literalHttpPaths: ["/healthz", "/readyz"],
    missingLiteralHttpPaths: ["/healthz", "/readyz"],
    templateEvidenceLines: [108, 150, 156],
    buildFile: "resolver/Dockerfile",
    buildEvidenceLines: [25, 34],
    entrypoint: "resolver/cmd/main.go",
    routeRegistrationLines: [121, 144, 145],
  }]);
  assert.match(request.prompt, /MANDATORY PREPARED OPERATIONAL-TARGET AUDIT/);
  assert.match(request.prompt, /changed deployment template: charts\/elasti\/templates\/deployment\.yaml/);
  assert.match(request.prompt, /build ownership evidence: resolver\/Dockerfile/);
  assert.match(request.prompt, /repository-built entrypoint: resolver\/cmd\/main\.go/);
  assert.match(request.prompt, /declared literal HTTP paths: \/healthz, \/readyz/);
  assert.match(request.prompt, /use read_file on every changed template, build file, and entrypoint/);
  assert.match(request.prompt, /exact template lines containing the literal paths/);
  assert.match(request.prompt, /exact build or ENTRYPOINT line proving binary ownership/);
  assert.match(request.prompt, /exact entrypoint lines containing the existing applicable route registrations/);
  assert.match(request.prompt, /do not weaken the claim to merely "unproven"/i);
  assert.equal(request.budget?.maximumOutputTokens, 12_000);
  assert.equal(request.budget?.timeoutMs, 300_000);
  assert.deepEqual(request.tools?.repository?.include, SOURCE_PATTERNS);
  for (const pattern of [
    "**/*.sh",
    "**/Makefile",
    "**/*.md",
    "**/integration/**/00-setup",
    "**/integration/**/01-start-server",
    "**/integration/**/02-bootstrap-agent",
    "**/integration/**/03-start-agent",
    "**/integration/**/04-submit-job",
    "**/integration/**/05-create-entry",
    "**/integration/**/06-verify-fetch",
    "**/integration/**/teardown",
    "Dockerfile",
    "Vagrantfile",
    ".github/workflows/**/*.yaml",
    "charts/**/templates/*.yaml",
    "**/charts/**/templates/**/*.yml",
  ]) {
    assert.equal(
      (request.tools?.repository?.include as readonly string[] | undefined)?.includes(pattern),
      true,
      pattern,
    );
  }
  assert.equal(request.tools?.repository?.maxRounds, 6);
  assert.equal(request.tools?.repository?.maxToolCalls, 24);
  assert.equal(request.tools?.repository?.maxTotalBytes, 192_000);
});
