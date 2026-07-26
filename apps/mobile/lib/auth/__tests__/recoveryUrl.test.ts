// ============================================================================
// PASSWORD-RECOVERY URL PARSING TESTS (Jest)
// ============================================================================
// The reset-link parser is the trickiest, most bug-prone part of the flow:
// Supabase delivers credentials in the URL *fragment* (implicit flow) or the
// *query* (PKCE), and the scheme differs between a standalone build
// (detour://…) and the Expo Go proxy (exp://…/--/…). These pure helpers must
// handle every shape.
// ============================================================================

import { paramsFromUrl, isRecoveryLink, credentialsFromParams } from '../recoveryUrl';

describe('paramsFromUrl', () => {
  it('reads tokens from the URL fragment (implicit flow)', () => {
    const url =
      'detour://reset-password#access_token=AAA&refresh_token=BBB&expires_in=3600&token_type=bearer&type=recovery';
    const p = paramsFromUrl(url);
    expect(p.get('access_token')).toBe('AAA');
    expect(p.get('refresh_token')).toBe('BBB');
    expect(p.get('type')).toBe('recovery');
  });

  it('reads a code from the query string (PKCE flow)', () => {
    const url = 'detour://reset-password?code=abc123';
    const p = paramsFromUrl(url);
    expect(p.get('code')).toBe('abc123');
    expect(p.get('access_token')).toBeNull();
  });

  it('handles the Expo Go proxy URL shape', () => {
    const url =
      'exp://127.0.0.1:8081/--/reset-password#access_token=XYZ&refresh_token=RRR&type=recovery';
    const p = paramsFromUrl(url);
    expect(p.get('access_token')).toBe('XYZ');
    expect(p.get('type')).toBe('recovery');
  });

  it('merges query and fragment params when both are present', () => {
    const url = 'detour://reset-password?foo=1#type=recovery&access_token=T';
    const p = paramsFromUrl(url);
    expect(p.get('foo')).toBe('1');
    expect(p.get('type')).toBe('recovery');
    expect(p.get('access_token')).toBe('T');
  });

  it('decodes percent-encoded error descriptions', () => {
    const url = 'detour://reset-password#error=access_denied&error_description=Email+link+is+invalid+or+has+expired';
    const p = paramsFromUrl(url);
    expect(p.get('error')).toBe('access_denied');
    // URLSearchParams decodes '+' to space.
    expect(p.get('error_description')).toBe('Email link is invalid or has expired');
  });

  it('returns an empty bag for a bare url with no params', () => {
    const p = paramsFromUrl('detour://reset-password');
    expect([...p.keys()]).toHaveLength(0);
  });
});

describe('isRecoveryLink', () => {
  it('is true when the path is reset-password', () => {
    const url = 'detour://reset-password';
    expect(isRecoveryLink(url, paramsFromUrl(url))).toBe(true);
  });

  it('is true when type=recovery even on a different path', () => {
    const url = 'detour://home#type=recovery&access_token=T&refresh_token=R';
    expect(isRecoveryLink(url, paramsFromUrl(url))).toBe(true);
  });

  it('is false for an unrelated deep link', () => {
    const url = 'detour://trips/123';
    expect(isRecoveryLink(url, paramsFromUrl(url))).toBe(false);
  });
});

describe('credentialsFromParams', () => {
  it('extracts implicit-flow credentials', () => {
    const c = credentialsFromParams(
      paramsFromUrl('detour://reset-password#access_token=A&refresh_token=B&type=recovery'),
    );
    expect(c).toEqual({
      accessToken: 'A',
      refreshToken: 'B',
      code: null,
      errorDescription: null,
      type: 'recovery',
    });
  });

  it('extracts a PKCE code', () => {
    const c = credentialsFromParams(paramsFromUrl('detour://reset-password?code=Z'));
    expect(c.code).toBe('Z');
    expect(c.accessToken).toBeNull();
  });

  it('surfaces an error over missing tokens', () => {
    const c = credentialsFromParams(
      paramsFromUrl('detour://reset-password#error=access_denied&error_description=expired'),
    );
    expect(c.errorDescription).toBe('expired');
    expect(c.accessToken).toBeNull();
    expect(c.refreshToken).toBeNull();
  });

  it('returns all-null for a bare recovery path (treated as expired downstream)', () => {
    const c = credentialsFromParams(paramsFromUrl('detour://reset-password'));
    expect(c.accessToken).toBeNull();
    expect(c.refreshToken).toBeNull();
    expect(c.code).toBeNull();
    expect(c.errorDescription).toBeNull();
  });
});
