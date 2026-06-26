// Password gate for the admin UI.
//
// This is deliberately minimal — it's a local-only tool for a solo admin,
// not production auth. The real security is: (a) this only runs on
// 127.0.0.1:5174, and (b) the service key never leaves the operator's
// machine. The password just stops over-the-shoulder access.

const KEY = 'mb_admin_authed_v1';

export function isAuthed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function signIn(password: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
  if (!expected) {
    // eslint-disable-next-line no-console
    console.warn('[admin] VITE_ADMIN_PASSWORD not set; refusing to authenticate.');
    return false;
  }
  if (password === expected) {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // sessionStorage can throw in private-mode; fall through.
    }
    return true;
  }
  return false;
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
