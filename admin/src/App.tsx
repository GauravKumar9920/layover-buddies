import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from '@/components/Shell';
import Login from '@/components/Login';
import OverviewPage from '@/pages/Overview';
import UsersPage from '@/pages/Users';
import BookingsPage from '@/pages/Bookings';
import RevenuePage from '@/pages/Revenue';
import SosPage from '@/pages/SOS';
import CancellationsPage from '@/pages/Cancellations';
import PayoutsPage from '@/pages/Payouts';
import SettingsPage from '@/pages/Settings';
import { isAuthed } from '@/lib/auth';

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => isAuthed());

  // Keep React state in sync with sessionStorage in case of external changes
  // (e.g. second tab signs out). Cheap and handles edge cases cleanly.
  useEffect(() => {
    const handler = () => setAuthed(isAuthed());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  return (
    <Routes>
      <Route element={<Shell onSignOut={() => setAuthed(false)} />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="/cancellations" element={<CancellationsPage />} />
        <Route path="/payouts" element={<PayoutsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
