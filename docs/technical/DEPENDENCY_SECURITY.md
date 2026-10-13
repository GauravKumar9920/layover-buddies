# Dependency security exceptions

The [2026-10-13 security review](SECURITY_REVIEW_2026-10-13.md) records the
dependency PRs, updated versions, remaining advisories, local guards and
verification evidence. The [dependency update policy](DEPENDENCY_UPDATE_POLICY.md)
describes the coordinated Expo/React/Babel/ESLint migration boundaries.

Dependency CI verifies the local guards and runs a live audit policy check:

```bash
npm run test:dependency-security
npm run security:dependencies
npm run test:security --prefix apps/studio
npm run security:dependencies --prefix apps/studio
```

[audit-dependencies.mjs](../../scripts/audit-dependencies.mjs) permits only
documented exact package/version/advisory combinations. New advisories, changed
guarded versions, invalid reports and registry failures stop the check. It
reports guarded and inherited findings explicitly; a passing policy is not a
claim that the raw upstream audit is clean. Its regression fixtures are in
[test-audit-dependencies.mjs](../../scripts/test-audit-dependencies.mjs).

## `image-size` malformed-image denial of service

The Expo 52 / React Native 0.76 Metro toolchain transitively installs
`image-size@1.2.1`. GitHub advisories
`GHSA-5p2g-fcmc-qvqq` and `GHSA-w3rx-r6r6-pgpr` cover infinite loops in the
JXL/HEIF ISO-BMFF box scanner and ICNS entry scanner. The only patched
releases are on the `image-size@2.x` line (`>= 2.0.3`), which removed the
default-export function that Metro 0.81 calls
(`const getImageSize = require("image-size")` in `metro/src/Assets.js`), so an
npm override would break asset bundling. There is no patched 1.x release;
upgrading away from the affected Metro line requires a full Expo and React
Native SDK migration. The dependency remains affected according to the
upstream advisory until that migration; local guards do not change the reported
package version or establish an upstream fix.

Until that migration is performed, `npm install` applies two fail-closed
guards through `scripts/patch-image-size.mjs`:

- ISO-BMFF boxes shorter than the required eight-byte header are rejected.
- ICNS entries shorter than their required eight-byte header are rejected.

`scripts/test-image-size-patch.mjs` supplies zero-length malicious structures
and verifies that both parsers terminate safely. CI runs this test immediately
after `npm ci`.

The patcher deliberately fails when the installed `image-size` version or
expected source changes. When Expo or Metro is upgraded, remove the patch only
after confirming that the upstream package contains equivalent guards and the
two GitHub advisories no longer apply.

## No upstream releases for braces, sprintf-js and node-forge

As verified on 2026-10-13, the following advisories have no published patched
version. Exact pins preserve reproducible local guards while keeping the real
upstream versions visible to npm audit and GitHub.

| Package/version | Advisory | Guard |
| --- | --- | --- |
| braces 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Limit actual brace/parenthesis parser nesting to 128, and preflight recursive AST operations with iterative depth/node/cycle checks. |
| sprintf-js 1.1.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Clamp invalid numeric precision to 0–100 (1–100 for `%g`) before native number conversion. Preserve valid formatting; patch both source and minified distributions. |
| node-forge 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Strictly validate the nested DigestAlgorithm sequence length and optional NULL before accepting RSA PKCS#1 v1.5 signatures. |

Root and Studio installs run
[patch-unreleased-security.mjs](../../scripts/patch-unreleased-security.mjs)
for braces/sprintf-js. Root also runs
[patch-forge-signature.mjs](../../scripts/patch-forge-signature.mjs).
Both patchers verify the exact version and reviewed source hashes, discover
all installed copies (including workspace-only and nested copies), and validate
all sources before writing. Unknown sources/versions fail installation. Scoped
workspace installs can omit these packages; every copy actually present still
must pass validation. Repeated application must leave files unchanged.

[test-unreleased-security.mjs](../../scripts/test-unreleased-security.mjs)
checks normal formats/patterns, deep hostile input with a subprocess timeout,
idempotency, omitted workspace packages, nested copies, tampering and prevention
of partial patch writes.
[test-forge-signature.mjs](../../scripts/test-forge-signature.mjs) verifies valid
RSA signatures and rejects malformed nested DigestAlgorithm values, along with
installation safety fixtures. Keep install scripts enabled: an audit allowlist
alone does not apply these protections.

### Maintenance and removal

1. Check the primary advisory and package release before changing a guarded
   version. Prefer a compatible upstream fix as soon as one exists.
2. Review changed upstream source before updating a source hash or patch anchor.
   Never make installation pass merely by accepting an unfamiliar file/version.
   Preserve normal API behavior and rerun the hostile-input regression cases.
3. Keep the guard, regression tests, exact override, lockfile and audit policy
   consistent. An unrelated advisory on an already guarded package must still
   fail the audit gate; do not add broad package/version/severity exclusions.
4. Verify fresh root and isolated Studio installs, guard checks and live audits.
   Dependency changes affecting mobile also require Expo alignment, mobile
   tests and bundling; verify the admin and marketing builds when their trees
   change. Keep React 19 Studio isolated from the Expo/React 18 workspaces.
5. Remove a local guard only after proving the installed upstream version closes
   the advisory and its regression cases pass without the patch. Update the
   exact audit policy and documentation together, and recheck GitHub alerts
   after merge. Do not invent package versions or dismiss an alert as fixed
   solely because a locally patched installation passes tests.

## `adm-zip` uncompressed-size denial of service (Studio only)

`apps/studio` pulls `adm-zip@0.6.0` through `@sanity/cli` (runtime CLI and
the module-federation DTS plugin, which pins `0.6.0` exactly). Advisory
`GHSA-7q85-xj36-vmfc` is fixed in `0.6.1`, so `apps/studio/package.json`
overrides `adm-zip` to `0.6.1`. Remove the override once upstream Sanity
packages depend on `>= 0.6.1` directly.
