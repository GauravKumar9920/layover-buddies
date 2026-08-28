import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AuthMFAEnrollResponse } from '@supabase/supabase-js';
import { AdminApiError, adminRequest, errorMessage } from '@/lib/api';
import { configState, getSupabase } from '@/lib/supabase';
import type { AdminSession } from '@/types/admin';

type AuthStage =
  | 'checking'
  | 'unconfigured'
  | 'signed-out'
  | 'mfa-enrol'
  | 'mfa-verify'
  | 'unauthorized'
  | 'ready'
  | 'error';

interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface AuthContextValue {
  stage: AuthStage;
  admin: AdminSession | null;
  problem: string | null;
  factorId: string | null;
  enrollment: TotpEnrollment | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  beginEnrollment: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toEnrollment(response: AuthMFAEnrollResponse): TotpEnrollment {
  if (response.error || !response.data || response.data.type !== 'totp') {
    throw response.error ?? new Error('Unable to start authenticator setup.');
  }
  return {
    factorId: response.data.id,
    qrCode: response.data.totp.qr_code,
    secret: response.data.totp.secret,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<AuthStage>(configState.configured ? 'checking' : 'unconfigured');
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [problem, setProblem] = useState<string | null>(configState.problem);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const checkId = useRef(0);

  const checkAccess = useCallback(async () => {
    if (!configState.configured) {
      setStage('unconfigured');
      setProblem(configState.problem);
      return;
    }

    const currentCheck = ++checkId.current;
    setStage('checking');
    setProblem(null);
    try {
      const client = getSupabase();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        setAdmin(null);
        setStage('signed-out');
        return;
      }

      const sessionResponse = await adminRequest('session.get');
      if (currentCheck !== checkId.current) return;
      setAdmin(sessionResponse.data);

      const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (sessionResponse.data.mfaRequired && assurance.currentLevel !== 'aal2') {
        const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const verified = factors.totp.find((factor) => factor.status === 'verified');
        setFactorId(verified?.id ?? null);
        setEnrollment(null);
        setStage(verified ? 'mfa-verify' : 'mfa-enrol');
        return;
      }

      if (sessionResponse.data.mfaRequired && sessionResponse.data.aal !== 'aal2') {
        throw new Error('Your elevated session was not accepted. Sign in again or contact the owner.');
      }
      setStage('ready');
    } catch (caught) {
      if (currentCheck !== checkId.current) return;
      const message = errorMessage(caught);
      const unauthorized = (caught instanceof AdminApiError && /MEMBERSHIP|FORBIDDEN|UNAUTHORIZED|INACTIVE/.test(caught.code.toUpperCase()))
        || /membership|forbidden|unauthori[sz]ed|inactive/i.test(message);
      setStage(unauthorized ? 'unauthorized' : 'error');
      setProblem(message);
    }
  }, []);

  useEffect(() => {
    if (!configState.configured) return;
    void checkAccess();
    const { data: listener } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        checkId.current += 1;
        setAdmin(null);
        setStage('signed-out');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'MFA_CHALLENGE_VERIFIED') {
        window.setTimeout(() => { void checkAccess(); }, 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [checkAccess]);

  const signIn = useCallback(async (email: string, password: string) => {
    setProblem(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setProblem(error.message);
      setStage('signed-out');
      return;
    }
    await checkAccess();
  }, [checkAccess]);

  const signOut = useCallback(async () => {
    checkId.current += 1;
    const { error } = await getSupabase().auth.signOut();
    if (error) setProblem(error.message);
    setAdmin(null);
    setStage('signed-out');
  }, []);

  const beginEnrollment = useCallback(async () => {
    setProblem(null);
    try {
      const client = getSupabase();
      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const stale = factors.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
      for (const factor of stale) {
        const { error: removeError } = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const response = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Detour Admin',
      });
      const next = toEnrollment(response);
      setEnrollment(next);
      setFactorId(next.factorId);
    } catch (caught) {
      setProblem(errorMessage(caught));
    }
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    const id = enrollment?.factorId ?? factorId;
    if (!id) {
      setProblem('No authenticator factor is available. Start setup again.');
      return;
    }
    setProblem(null);
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() });
    if (error) {
      setProblem(error.message);
      return;
    }
    await checkAccess();
  }, [checkAccess, enrollment, factorId]);

  const value = useMemo<AuthContextValue>(() => ({
    stage,
    admin,
    problem,
    factorId,
    enrollment,
    signIn,
    signOut,
    beginEnrollment,
    verifyMfa,
    retry: checkAccess,
  }), [stage, admin, problem, factorId, enrollment, signIn, signOut, beginEnrollment, verifyMfa, checkAccess]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.stage === 'ready') return <>{children}</>;
  return <AuthScreen />;
}

function AuthScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    void run(() => auth.signIn(email, password));
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    void run(() => auth.verifyMfa(code));
  }

  const title = auth.stage === 'unconfigured'
    ? 'Connect the console'
    : auth.stage === 'mfa-enrol'
      ? 'Protect this account'
      : auth.stage === 'mfa-verify'
        ? 'Verify it’s you'
        : auth.stage === 'unauthorized'
          ? 'Access not granted'
          : auth.stage === 'error'
            ? 'Couldn’t verify access'
            : 'Welcome back';

  return (
    <main className="auth-canvas">
      <section className="auth-story">
        <div className="brand-mark" aria-hidden="true"><span>D</span></div>
        <p className="eyebrow text-white/65">Detour operations</p>
        <h1 className="font-heading text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          Keep every Mumbai<br />welcome on track.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
          One secure home for traveler requests, Buddy readiness, safety, money and growth.
        </p>
        <div className="mt-auto flex gap-5 text-xs text-white/55">
          <span>Authenticated</span><span>•</span><span>Audited</span><span>•</span><span>MFA protected</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="brand-mark brand-mark-small"><span>D</span></div>
            <div><strong className="font-heading">Detour</strong><p className="text-xs text-muted">Admin</p></div>
          </div>
          <p className="eyebrow">Secure team console</p>
          <h2 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{title}</h2>

          {auth.stage === 'checking' && <AuthNotice tone="neutral" title="Checking your session…" body="Confirming membership and authenticator assurance." />}

          {auth.stage === 'unconfigured' && (
            <AuthNotice
              tone="warn"
              title="Public configuration is missing"
              body={auth.problem ?? 'Add the project URL and public anon key, then restart the console.'}
            />
          )}

          {auth.stage === 'signed-out' && (
            <form className="mt-8 space-y-4" onSubmit={submitCredentials}>
              <label className="field-label">Work email
                <input className="field-input mt-2" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@detourtrips.com" />
              </label>
              <label className="field-label">Password
                <input className="field-input mt-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" />
              </label>
              {auth.problem && <p className="form-error" role="alert">{auth.problem}</p>}
              <button className="primary-button w-full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Continue securely'}</button>
            </form>
          )}

          {auth.stage === 'mfa-enrol' && (
            <div className="mt-7">
              {!auth.enrollment ? (
                <>
                  <p className="text-sm leading-6 text-muted">Admin access requires an authenticator app. This setup is tied to your Supabase account, not this browser.</p>
                  {auth.problem && <p className="form-error mt-4">{auth.problem}</p>}
                  <button className="primary-button mt-5 w-full" disabled={busy} onClick={() => void run(auth.beginEnrollment)}>{busy ? 'Starting…' : 'Set up authenticator'}</button>
                </>
              ) : (
                <form onSubmit={submitCode}>
                  <div className="rounded-2xl border border-divider bg-white p-5 text-center">
                    <img src={auth.enrollment.qrCode} alt="Authenticator QR code" className="mx-auto h-44 w-44" />
                    <p className="mt-3 text-xs text-muted">Can’t scan? Enter this setup key:</p>
                    <code className="mt-1 block break-all text-xs font-semibold text-navy">{auth.enrollment.secret}</code>
                  </div>
                  <VerificationCode value={code} onChange={setCode} />
                  {auth.problem && <p className="form-error mt-3">{auth.problem}</p>}
                  <button className="primary-button mt-4 w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and enter'}</button>
                </form>
              )}
            </div>
          )}

          {auth.stage === 'mfa-verify' && (
            <form className="mt-7" onSubmit={submitCode}>
              <p className="text-sm leading-6 text-muted">Enter the six-digit code from your authenticator app to unlock privileged operations.</p>
              <VerificationCode value={code} onChange={setCode} />
              {auth.problem && <p className="form-error mt-3">{auth.problem}</p>}
              <button className="primary-button mt-4 w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and enter'}</button>
              <button className="secondary-button mt-3 w-full" type="button" onClick={() => void auth.signOut()}>Use another account</button>
            </form>
          )}

          {(auth.stage === 'unauthorized' || auth.stage === 'error') && (
            <div className="mt-7">
              <AuthNotice tone="danger" title={auth.stage === 'unauthorized' ? 'No active admin membership' : 'Access check failed'} body={auth.problem ?? 'The server did not accept this session.'} />
              <div className="mt-4 flex gap-3">
                <button className="primary-button flex-1" onClick={() => void auth.retry()}>Try again</button>
                <button className="secondary-button flex-1" onClick={() => void auth.signOut()}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function VerificationCode({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label mt-5 block">Six-digit code
      <input
        className="field-input mt-2 text-center font-mono text-xl tracking-[0.35em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        autoFocus
      />
    </label>
  );
}

function AuthNotice({ tone, title, body }: { tone: 'neutral' | 'warn' | 'danger'; title: string; body: string }) {
  return (
    <div className={`mt-7 rounded-2xl border p-4 auth-notice-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm leading-5 opacity-80">{body}</p>
    </div>
  );
}
