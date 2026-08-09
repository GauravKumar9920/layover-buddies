import path from 'node:path';

// Astro bundles build-time modules into dist/chunks, so import.meta.url no
// longer points beside src/legacy during prerendering. Workspace scripts run
// with apps/marketing as cwd in npm, Turbo, and Vercel.
export const legacyRoot = path.resolve(process.cwd(), 'src/legacy');

/** Resolve a checked-in parity source without allowing traversal outside src/legacy. */
export function resolveLegacyPath(source) {
  const safeSource = String(source).replace(/^\/+/, '');
  const fullPath = path.resolve(legacyRoot, safeSource);
  if (fullPath !== legacyRoot && !fullPath.startsWith(`${legacyRoot}${path.sep}`)) {
    throw new Error('Invalid legacy source path');
  }
  return fullPath;
}
