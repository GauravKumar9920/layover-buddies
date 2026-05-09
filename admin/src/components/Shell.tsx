import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from '@/lib/auth';

interface NavItem {
  to: string;
  label: string;
  emoji: string;
}

const NAV: NavItem[] = [
  { to: '/users',         label: 'Users',         emoji: '👥' },
  { to: '/bookings',      label: 'Bookings',      emoji: '🧾' },
  { to: '/revenue',       label: 'Revenue',       emoji: '💰' },
  { to: '/sos',           label: 'SOS events',    emoji: '🚨' },
  { to: '/cancellations', label: 'Cancellations', emoji: '❌' },
  { to: '/payouts',       label: 'Payouts',       emoji: '💳' },
];

interface Props {
  onSignOut: () => void;
}

export default function Shell({ onSignOut }: Props) {
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    onSignOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-divider flex flex-col">
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary" />
          <div>
            <div className="font-heading text-base font-bold leading-none">Mumbai Buddies</div>
            <div className="text-[11px] text-muted mt-1 uppercase tracking-wider">Admin</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-primary-light text-primary-dark'
                    : 'text-ink hover:bg-cream',
                ].join(' ')
              }
            >
              <span className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-divider">
          <button
            onClick={handleSignOut}
            className="w-full h-10 rounded-lg text-sm text-muted hover:bg-cream hover:text-ink transition"
          >
            Sign out
          </button>
          <div className="mt-2 text-[10px] text-muted text-center">
            Local only · bypasses RLS
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
