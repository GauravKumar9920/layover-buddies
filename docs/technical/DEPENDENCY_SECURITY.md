# Dependency security exceptions

## `image-size` malformed-image denial of service

The Expo 52 / React Native 0.76 Metro toolchain transitively installs
`image-size@1.2.1`. GitHub advisories
`GHSA-5p2g-fcmc-qvqq` and `GHSA-w3rx-r6r6-pgpr` cover infinite loops in the
JXL/HEIF ISO-BMFF box scanner and ICNS entry scanner. No patched npm release
is available; upgrading away from the affected Metro line requires a full
Expo and React Native SDK migration.

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
