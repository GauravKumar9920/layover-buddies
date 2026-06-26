/* eslint-disable import/first */
// ============================================================================
// REGISTER PUSH TOKEN TESTS — Phase 5 (Jest)
// ============================================================================
// Pure-logic coverage of the registration flow.  Mocks expo-notifications,
// expo-device, expo-constants, react-native, and the supabase client so the
// test runs in a node environment without any native bindings.
//
// Note: the jest.mock() calls must execute before the registerPushToken
// import, so we disable import/first for this file.
// ============================================================================

// ─── Globals ────────────────────────────────────────────────────────────────
// React Native injects __DEV__ at runtime; the test environment is plain Node,
// so define it before the helper module is imported.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetPermissionsAsync     = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync   = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync:     (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync:   (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
}));

const mockDevice = { isDevice: true, osInternalBuildId: 'build-1' };
jest.mock('expo-device', () => ({
  get isDevice() { return mockDevice.isDevice; },
  get osInternalBuildId() { return mockDevice.osInternalBuildId; },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'project-id-123' } } },
    easConfig:  { projectId: 'project-id-123' },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Track upsert calls.  The hoisting weirdness means we declare the spy here
// and re-bind it each test.
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null }),
});

jest.mock('../../supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    }),
  },
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { registerPushTokenIfPossible, invalidateOwnPushTokenOnLogout }
  from '../registerPushToken';

// ─── Test fixtures ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockDevice.isDevice = true;
  mockDevice.osInternalBuildId = 'build-1';
  mockUpsert.mockResolvedValue({ error: null });
  mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExpoPushToken[abc]' });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('registerPushTokenIfPossible', () => {
  it('skips on a simulator (Device.isDevice false)', async () => {
    mockDevice.isDevice = false;
    const result = await registerPushTokenIfPossible('user-1');
    expect(result).toBeNull();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns null and skips upsert when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await registerPushTokenIfPossible('user-1');
    expect(result).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('requests permission when initial status is undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const result = await registerPushTokenIfPossible('user-1');
    expect(result).toBe('ExpoPushToken[abc]');
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('upserts the token and returns it on success', async () => {
    const result = await registerPushTokenIfPossible('user-1');
    expect(result).toBe('ExpoPushToken[abc]');
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const [row, options] = mockUpsert.mock.calls[0] as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(row.user_id).toBe('user-1');
    expect(row.expo_push_token).toBe('ExpoPushToken[abc]');
    expect(row.platform).toBe('ios');
    expect(row.device_id).toBe('build-1');
    expect(row.is_valid).toBe(true);
    expect(options.onConflict).toBe('expo_push_token');
  });

  it('returns null and does not throw if upsert returns an error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'rls denied' } });
    await expect(registerPushTokenIfPossible('user-1')).resolves.toBeNull();
  });

  it('returns null and does not throw if Expo throws fetching the token', async () => {
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('network down'));
    await expect(registerPushTokenIfPossible('user-1')).resolves.toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns null when Expo returns an empty token data', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: '' });
    const result = await registerPushTokenIfPossible('user-1');
    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('invalidateOwnPushTokenOnLogout', () => {
  it('skips on a simulator', async () => {
    mockDevice.isDevice = false;
    await invalidateOwnPushTokenOnLogout();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the user_push_tokens row on a real device', async () => {
    await invalidateOwnPushTokenOnLogout();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [patch] = mockUpdate.mock.calls[0] as [Record<string, unknown>];
    expect(patch.is_valid).toBe(false);
    expect(patch.invalidated_reason).toBe('user_logout');
  });

  it('swallows fetch errors silently', async () => {
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('network'));
    await expect(invalidateOwnPushTokenOnLogout()).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
