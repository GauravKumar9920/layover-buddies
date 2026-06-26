// @detour/config — shared design tokens + business-rule constants.
// Consumed by apps/mobile today; safe for apps/admin and other packages to
// adopt. (The Deno edge functions can't import this npm package directly, so
// they intentionally mirror a few constants — keep those in sync by hand.)
export * from './theme';
export * from './constants';
