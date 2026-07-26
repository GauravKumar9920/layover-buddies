import { usePasswordRecovery } from '../passwordRecovery';

describe('password recovery phases', () => {
  beforeEach(() => {
    usePasswordRecovery.getState().finish();
  });

  it('does not mark the reset form ready until session establishment completes', () => {
    usePasswordRecovery.getState().begin();
    expect(usePasswordRecovery.getState().status).toBe('establishing');

    usePasswordRecovery.getState().markReady();
    expect(usePasswordRecovery.getState().status).toBe('ready');
  });

  it('returns to idle after completion or cancellation', () => {
    usePasswordRecovery.getState().begin();
    usePasswordRecovery.getState().markReady();
    usePasswordRecovery.getState().finish();

    expect(usePasswordRecovery.getState().status).toBe('idle');
  });
});
