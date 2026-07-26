// Business-rule constants now live in the shared @detour/config package.
// Re-export only the constants surface so `@/config/constants` stays scoped.
export * from '@detour/config/constants';

// ── Legal & support links (mobile-facing) ───────────────────────────────────
// Static pages served by the marketing site (apps/marketing/terms.html →
// /terms via vercel cleanUrls). Surfaced as tappable links in signup + profile
// (Apple/Google both require reachable Terms + Privacy) and in the
// delete-account disclosure. Kept local to the mobile app (not @detour/config)
// because they're app-facing URLs consumed only by the mobile UI.
export const LEGAL = {
  termsUrl: 'https://detourtrips.com/terms',
  privacyUrl: 'https://detourtrips.com/privacy',
} as const;
export const SUPPORT_EMAIL = 'hello@detourtrips.com';
