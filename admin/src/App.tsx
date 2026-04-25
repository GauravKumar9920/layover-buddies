import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from '@/components/Shell';
import Login from '@/components/Login';
import UsersPage from '@/pages/Users';
import BookingsPage from '@/pages/Bookings';
import RevenuePage from '@/pages/Revenue';
import SosPage from '@/pages/SOS';
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
        <Route path="/" element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="*" element={<Navigate to="/users" replace />} />
      </Route>
    </Routes>
  );
}
