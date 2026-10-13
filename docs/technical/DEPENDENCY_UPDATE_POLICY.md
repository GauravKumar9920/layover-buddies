# Dependency update policy

Verified on 2026-10-13 against the root workspace manifests, lockfile, and the
current GitHub checks. Sanity Studio has its own React 19 installation and
lockfile; its versions do not change the mobile application's compatibility.

## Platform upgrades

The mobile application uses Expo 52, React Native 0.76.9, and React 18.3.1.
Treat their runtime, renderer, types, native libraries, and Babel preset as a
coordinated platform upgrade. Run `expo install --check --npm` without exclusions
after every dependency change. Never bypass peer dependencies or disable the
alignment check to make a dependency PR pass.

The following independent major updates must not be merged into this platform:

| PR | Change | Verified failure and follow-up |
| --- | --- | --- |
| [#101](https://github.com/GauravKumar9920/layover-buddies/pull/101) | Babel 7 → 8 | Expo's alignment check requires `@babel/core@^7.25.2`. The installed Expo/RN presets still use Babel 7 plugins. Migrate the preset and plugin stack together with a compatible SDK. |
| [#102](https://github.com/GauravKumar9920/layover-buddies/pull/102) | ESLint 8 → 10 | The lint job fails because `eslint.config.*` is absent. ESLint 10 removes legacy `.eslintrc` support; migrate the config and validate every plugin in a dedicated change. |
| [#103](https://github.com/GauravKumar9920/layover-buddies/pull/103) | React/types 18 → 19 | Expo's alignment check requires React `18.3.1` and React types `~18.3.12`. RN 0.76.9 declares React 18 peers. The PR also upgrades React independently of React DOM. |
| [#104](https://github.com/GauravKumar9920/layover-buddies/pull/104) | React DOM/types 18 → 19 | Expo's alignment check requires React DOM `18.3.1`. The PR leaves React 18 in place while replacing its renderer with React DOM 19. |

The root Dependabot configuration ignores only semver-major version updates for
these six package names. Patch and minor updates remain eligible. Dependabot's
security-update path does not apply ignore rules expressed only with
`update-types`; it applies explicit `versions` rules. Do not add blanket version
ignores to these packages. A security fix that requires a platform migration
must receive a dedicated compatibility review rather than an automatic merge.

Sources: [Expo 52 release](https://expo.dev/changelog/2024-11-12-sdk-52),
[Babel 8 migration](https://babeljs.io/docs/v8-migration),
[ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0), and
[Dependabot's ignore-condition implementation](https://github.com/dependabot/dependabot-core/blob/main/common/lib/dependabot/config/ignore_condition.rb).

## CI runtime and action dependencies

The root dependency tree includes patched Undici 8, which requires Node 22.19
or newer on the Node 22 line. Studio uses the same minimum runtime. CI exercises
that minimum version.
GitHub Actions runtimes are separate from the project's Node version:
checkout 7.0.1 and setup-node 7.1.0 themselves use Node 24.

Workflow action releases are pinned to commit SHAs. GitHub Actions Dependabot
updates keep those pins reviewable. CI checkout credentials are not persisted,
because builds and tests require only repository read access.

Sources: [checkout](https://github.com/actions/checkout),
[setup-node](https://github.com/actions/setup-node),
[Deno setup](https://github.com/denoland/setup-deno), and
[Supabase CLI setup](https://github.com/supabase/setup-cli).

## CodeQL checks on Dependabot PRs

CodeQL default setup is configured for Actions, JavaScript/TypeScript, and
Python. All three configurations successfully analyzed `main` at commit
`04d68948785d6d210212fbf093df339971ba9083` on 2026-10-13, and analyzed human PR
#108. Dependabot PRs have a neutral check reporting three missing
configurations because GitHub intentionally skips those PRs in default setup.
This result is not evidence that a PR passed a source-code security scan.

Retain default scanning and verify the human integration PR's CodeQL results
when consolidating dependency fixes. Use dependency checks for the lockfile
changes themselves. Do not weaken code-scanning requirements or use
`pull_request_target` to execute bot PR code with privileged credentials.

If source scanning of every Dependabot PR becomes necessary, stage an advanced
CodeQL workflow and coordinate disabling default setup; both setups cannot
upload analyses concurrently. The default-setup API has no option to enable
Dependabot PR scanning.

Sources: [CodeQL maintainer explanation](https://github.com/github/codeql-action/issues/2858#issuecomment-2802039792)
and [default-setup API](https://docs.github.com/en/rest/code-scanning/code-scanning#update-a-code-scanning-default-setup-configuration).
