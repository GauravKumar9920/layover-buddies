import { useState, FormEvent } from 'react';
import { signIn } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';

interface Props {
  onAuthed: () => void;
}

export default function Login({ onAuthed }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const configured = isConfigured();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (signIn(password)) {
      onAuthed();
    } else {
      setError('Wrong password.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-divider p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary" />
          <div>
            <div className="font-heading text-lg font-bold leading-none">Mumbai Buddies</div>
            <div className="text-xs text-muted">Admin — local only</div>
          </div>
        </div>

        <h1 className="mt-6 font-heading text-2xl font-bold">Enter password</h1>
        <p className="mt-1 text-sm text-muted">
          This console is gated. Set <code>VITE_ADMIN_PASSWORD</code> in{' '}
          <code>admin/.env.local</code>.
        </p>

        {!configured && (
          <div className="mt-4 p-3 rounded-lg bg-warn/10 text-warn text-xs border border-warn/30">
            Supabase env vars missing. Copy <code>.env.local.example</code> →{' '}
            <code>.env.local</code> and fill in <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_SERVICE_KEY</code>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full h-12 px-4 rounded-xl border border-divider bg-cream focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark transition"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
