# Detour Content Studio

This Sanity Studio workspace provides structured guide, landing-page, SEO,
FAQ, testimonial, source, and media editing. It is intentionally separate from
the operational admin: editors get Sanity drafts, previews, history, publishing
and rollback without exposing marketplace credentials or a custom page builder.

Studio intentionally owns a separate lockfile and `node_modules` tree so its
React 19 runtime cannot be hoisted into the React 18 admin application. From
the repository root, install it independently, copy `.env.example` to
`.env.local`, provide a Sanity project ID, then run:

```bash
npm install --prefix apps/studio
npm run studio
```

See `docs/publishing.md` for CORS, preview, webhook, Vercel Deploy Hook, secret,
deployment-recording, and rollback setup.

`npm run studio:build` and `npm run studio:test` use a non-secret placeholder
project in CI when no real Studio environment is supplied.

The isolated lockfile pins security fixes for the Studio and CLI dependencies.
Two upstream advisories still have no patched release: braces nesting
(GHSA-vfj7-8cjw-p6xm) and sprintf-js numeric precision (GHSA-hp3w-g68c-fv3c).
The install hook applies reviewed, source-verified local guards to every copy:
braces rejects patterns above 128 nesting levels and validates supplied ASTs;
sprintf-js clamps invalid numeric precision to the native 0–100 range (1–100
for `%g`). Valid patterns and formatting retain their behavior. Audit tools
continue to report the actual upstream versions and inherited findings.

Do not skip install scripts. `npm run test:security --prefix apps/studio`
checks the guards, nested copies, install idempotency, source tampering, normal
inputs, and hostile inputs in subprocesses with a timeout. An unknown version
or changed upstream source stops installation so the guard can be reviewed
before updating or removing it.
