# Security and quality review — 2026-10-13

The review covered the 17 open dependency PRs, both npm lockfiles, the existing
image parser mitigation, CI dependency handling, website account sessions, and
payment webhook recovery. This document records the implementation and local
evidence. GitHub PR closure, integration merge, remote checks, and post-merge
alert counts require separate verification; they are not asserted here.

## Dependency PR disposition

Thirteen compatible dependency PRs are represented in the consolidated fix
set. Four independent major updates require a platform/configuration migration
and were excluded. The existing Expo 52 / React Native 0.76.9 / React 18.3.1
platform is retained. See [Dependency update policy](DEPENDENCY_UPDATE_POLICY.md)
for the reproduced compatibility failures and future migration requirements.

| PR | Reviewed change | Implementation/disposition |
| --- | --- | --- |
| [#101](https://github.com/GauravKumar9920/layover-buddies/pull/101) | Babel 8 | Defer to a coordinated Expo preset/plugin migration; keep Babel 7. |
| [#102](https://github.com/GauravKumar9920/layover-buddies/pull/102) | ESLint 10 | Defer until flat config and plugin migration; keep ESLint 8. |
| [#103](https://github.com/GauravKumar9920/layover-buddies/pull/103) | React/types 19 | Defer to an Expo/RN platform migration; keep the mobile React 18 runtime/types aligned. |
| [#104](https://github.com/GauravKumar9920/layover-buddies/pull/104) | React DOM/types 19 | Defer with React; retain the matching React DOM 18 renderer. |
| [#105](https://github.com/GauravKumar9920/layover-buddies/pull/105) | Undici | Root 6.29.0 and 8.10.2; Studio 6.28.1 and 7.29.1. Keep each consumer on its existing major. |
| [#106](https://github.com/GauravKumar9920/layover-buddies/pull/106) | Studio markdown-it | Lock 14.3.2 in the isolated Studio installation. |
| [#109](https://github.com/GauravKumar9920/layover-buddies/pull/109) | brace-expansion | Lock 1.1.21, 2.1.7 and 5.0.12 according to the consuming major; Studio has only the latter two. |
| [#110](https://github.com/GauravKumar9920/layover-buddies/pull/110) | smol-toml | Root 1.9.1; Studio 1.9.0, including its previously older Vercel dependency. |
| [#111](https://github.com/GauravKumar9920/layover-buddies/pull/111) | Handlebars | Lock 4.7.10. |
| [#112](https://github.com/GauravKumar9920/layover-buddies/pull/112) | http-cache-semantics | Lock 4.3.0. |
| [#113](https://github.com/GauravKumar9920/layover-buddies/pull/113) | source-map-js | Lock 1.2.2 in both installations. |
| [#114](https://github.com/GauravKumar9920/layover-buddies/pull/114) | Sharp | Lock 0.35.5. |
| [#115](https://github.com/GauravKumar9920/layover-buddies/pull/115) | devalue | Lock 5.9.4. |
| [#116](https://github.com/GauravKumar9920/layover-buddies/pull/116) | compression | Lock 1.8.2. |
| [#117](https://github.com/GauravKumar9920/layover-buddies/pull/117) | shell-quote | Lock 1.12.0. |
| [#118](https://github.com/GauravKumar9920/layover-buddies/pull/118) | Ten patch/minor updates | Include Supabase JS 2.117.3, Vite 8.3.4, its React plugin 6.1.2, PostCSS 8.5.29, Astro 7.3.8, QR SVG 6.3.26, Node types 22.20.5, Prettier 3.9.10, ts-jest 29.4.14 and Turbo 2.11.7. |
| [#119](https://github.com/GauravKumar9920/layover-buddies/pull/119) | fast-uri | Lock 3.1.8. |

Additional alert fixes include DOMPurify 3.4.16 and postcss-selector-parser
7.1.6. Root and Studio retain separate locks and React versions. The root's
patched Undici 8 requires Node 22.19 on the Node 22 line; engine declarations
and CI are aligned to that minimum.

## Remaining upstream advisories and local guards

The initial GitHub snapshot contained **67 open Dependabot alerts**: 41 in the
root lockfile and 26 in the Studio lockfile. The implemented upstream updates
are expected to resolve 62 of those alerts after the final lockfiles reach the
default branch. Five alerts in that snapshot have no published upstream fix:
root #184, #185 and #191, plus Studio #162 and #166. Re-query GitHub after merge
to verify the actual remaining count; do not dismiss these as upstream-fixed.

| Exact dependency | Advisory | Mitigation and evidence |
| --- | --- | --- |
| braces 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Guard actual parser nesting at 128 levels; iteratively validate AST depth, node count and cycles before recursive compile/expand/stringify operations. Test deep patterns below the upstream length cap, direct ASTs, valid escaped/quoted/bracket patterns, nested installed copies and source tampering. Upstream lists no patched version. |
| sprintf-js 1.1.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Clamp invalid numeric precision to ECMAScript's 0–100 range (1–100 for `%g`) in both normal and minified distributions. Test ordinary formats, positional/named arguments, boundaries and very long precision fields. Upstream lists no patched version. |
| node-forge 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Validate nested DigestAlgorithm element count and NULL parameters before accepting RSA PKCS#1 v1.5 signatures. Regression tests cover valid signatures, altered digests and malformed nested ASN.1. Upstream lists no patched version. |
| image-size 1.2.1 | [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | Retain the existing Metro-compatible guard rejecting zero/undersized ISO BMFF and ICNS entries. Upstream fixes exist in 2.0.3, whose API differs from the current Metro consumer; the local guard preserves the existing callable API. Tests exercise malformed box and ICNS entry termination. |

`patch-unreleased-security.mjs` and `patch-forge-signature.mjs` verify exact
versions and reviewed source hashes before applying their changes. All installed
copies are discovered, including workspace-only and nested packages. Scoped
installs may omit dependency trees recorded in the root lockfile; an installed
copy with an unrecognized version or source still fails installation. Changes
are verified before writes, and repeated installation is idempotent. The
existing image-size patch checks its exact version and reviewed source anchors.

Package versions remain their real upstream values. Raw npm audit therefore
continues to report these advisories and their inherited dependency impact.
The live policy check observed **64 root package entries** (five advisories in
four guarded packages, plus 60 inherited entries) and **13 Studio entries**
(two advisories in two guarded packages, plus 11 inherited entries). These are
package-impact counts rather than distinct security defects; registry metadata
or a changed dependency graph can change them.

`scripts/audit-dependencies.mjs` runs live `npm audit --package-lock-only
--json` and accepts only the exact package/version/advisory combinations above.
It checks every reported affected node against the selected lockfile and checks
that inherited findings reach a reviewed direct advisory. A new direct advisory,
different guarded version, unresolved finding, invalid report, timeout, registry
error, or inconsistent exit status fails the gate. Guard regression checks are
required separately; passing this policy is not a clean upstream audit claim.

## Quality changes reviewed alongside dependency updates

The website account refresh code preserves a newer sign-out/account switch
while a previous refresh request is in flight. Transient network/server failures
retain retryable credentials; rejected refresh tokens remove only the session
that initiated that request. Saving a place after sign-out now produces an
explicit signed-out result. Regression coverage lives in
`apps/marketing/tests/account-session.test.mjs`.

Payment changes prevent late failure webhooks from overwriting captured or
refunded ledgers. Replayed capture events finish dependent writes after a prior
partial failure and check concurrent state changes. Top-up creation records the
canonical `user_id`, reuses its durable idempotency key/order, and requires the
order link write to succeed before returning checkout details. A checkout
failure preserves the traveler's top-up approval for retry. See the payment
failure, capture recovery and top-up order tests under
`supabase/functions/__tests__/`.

CI runs install-time guard checks and preserves Expo dependency alignment.
Actions are pinned to reviewed commit SHAs, checkout credentials are not
persisted, and GitHub Actions update PRs are enabled. Payment webhook/top-up
entry points are included in Deno type checking. CodeQL's neutral Dependabot
checks are not source-scan passes; verify source scanning on the human
integration PR, as described in the dependency policy.

## Local evidence captured for this report

These commands passed on Node 24.14.1 in the remediation worktree:

```bash
npm ci --prefix apps/studio --no-audit --no-fund
npm run test:security --prefix apps/studio
npm run type-check --prefix apps/studio
npm test --prefix apps/studio
npm run build --prefix apps/studio
node scripts/test-unreleased-security.mjs .
node scripts/test-unreleased-security.mjs apps/studio
node scripts/test-audit-dependencies.mjs
node scripts/audit-dependencies.mjs .
node scripts/audit-dependencies.mjs apps/studio
```

The shared guard fixtures verify idempotency, unexpected versions/sources,
partial-write prevention, omitted workspace dependencies, normal inputs, and
hostile subprocesses with a hard timeout. Audit fixtures inject new advisories,
wrong nested versions, missing nodes, registry failures, malformed JSON and
unrooted inherited cycles. Root application verification also passed: 452 mobile tests across 23 suites;
strict mobile lint with zero warnings; repository type checking; six admin
contract tests and its production build/bundle secret scan; 39 marketing tests
and 97 route checks; Expo dependency alignment and web export; 112 Edge Function
tests and all 13 CI Deno entry-point type checks. Desktop/mobile marketing
rendering and guest place saving were checked in the local browser, and the
Expo login rendered its expected missing-configuration notice. No production
credentials were copied into this worktree.

Local Docker was unavailable, so clean-database migration and transaction tests
must pass in integration CI before merge. Payment tests use mocked provider and
database boundaries; no real Razorpay payment was executed. Deployment of the
changed `razorpay-webhook` and `create-topup-order` Edge Functions is separate
from merging these source fixes. Integration CI and final GitHub disposition
require remote verification.
