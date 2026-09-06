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
