import { usePasswordRecovery } from '../passwordRecovery';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('password recovery phases', () => {
  beforeEach(async () => {
    await usePasswordRecovery.getState().finish();
    usePasswordRecovery.setState({ hydrated: false });
  });

  it('does not mark the reset form ready until session establishment completes', async () => {
    await usePasswordRecovery.getState().begin();
    expect(usePasswordRecovery.getState().status).toBe('establishing');

    await usePasswordRecovery.getState().markReady();
    expect(usePasswordRecovery.getState().status).toBe('ready');
  });

  it('returns to idle after completion or cancellation', async () => {
    await usePasswordRecovery.getState().begin();
    await usePasswordRecovery.getState().markReady();
    await usePasswordRecovery.getState().finish();

    expect(usePasswordRecovery.getState().status).toBe('idle');
  });

  it('restores a ready recovery after an app restart', async () => {
    await usePasswordRecovery.getState().markReady();

    // Simulate a fresh JS process before the async store hydrates.
    usePasswordRecovery.setState({ status: 'idle', hydrated: false });
    await usePasswordRecovery.getState().hydrate();

    expect(usePasswordRecovery.getState()).toMatchObject({
      status: 'ready',
      hydrated: true,
    });
  });
});
