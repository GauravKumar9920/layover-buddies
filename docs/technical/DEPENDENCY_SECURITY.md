# Dependency security exceptions

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
Native SDK migration. The Dependabot alert for this package is therefore
expected to stay open (or be dismissed as tolerable risk) until that migration.

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

## `adm-zip` uncompressed-size denial of service (Studio only)

`apps/studio` pulls `adm-zip@0.6.0` through `@sanity/cli` (runtime CLI and
the module-federation DTS plugin, which pins `0.6.0` exactly). Advisory
`GHSA-7q85-xj36-vmfc` is fixed in `0.6.1`, so `apps/studio/package.json`
overrides `adm-zip` to `0.6.1`. Remove the override once upstream Sanity
packages depend on `>= 0.6.1` directly.
