import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import Icon, { type IconName } from '@/components/Icon';
import GlobalSearch from '@/components/GlobalSearch';
import { canAccessPath } from '@/lib/permissions';

interface NavItem { to: string; label: string; icon: IconName; badge?: 'critical' }
interface NavGroup { label: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/overview', label: 'Command centre', icon: 'overview' }] },
  { label: 'Operations', items: [
    { to: '/operations/leads', label: 'Website leads', icon: 'inbox' },
    { to: '/operations/inquiries', label: 'Inquiries', icon: 'booking' },
    { to: '/operations/bookings', label: 'Bookings', icon: 'booking' },
    { to: '/operations/live', label: 'Live trips', icon: 'live' },
    { to: '/operations/disputes', label: 'Disputes', icon: 'dispute' },
  ] },
  { label: 'Marketplace', items: [
    { to: '/marketplace/travelers', label: 'Travelers', icon: 'traveler' },
    { to: '/marketplace/buddies', label: 'Buddies', icon: 'buddy' },
    { to: '/marketplace/itineraries', label: 'Itineraries', icon: 'route' },
    { to: '/marketplace/reviews', label: 'Reviews', icon: 'review' },
  ] },
  { label: 'Trust & safety', items: [
    { to: '/trust/sos', label: 'SOS alerts', icon: 'sos', badge: 'critical' },
    { to: '/trust/reports', label: 'Reports', icon: 'report' },
    { to: '/trust/access', label: 'Sensitive access', icon: 'shield' },
    { to: '/trust/deletions', label: 'Account deletion', icon: 'delete' },
  ] },
  { label: 'Money', items: [
    { to: '/money/ledger', label: 'Ledger', icon: 'money' },
    { to: '/money/cancellations', label: 'Cancellations', icon: 'refund' },
    { to: '/money/refunds', label: 'Refunds', icon: 'refund' },
    { to: '/money/payouts', label: 'Payouts', icon: 'payout' },
    { to: '/money/pricing', label: 'Pricing', icon: 'pricing' },
  ] },
  { label: 'Growth & content', items: [
    { to: '/growth', label: 'Website analytics', icon: 'growth' },
    { to: '/content', label: 'Publishing', icon: 'content' },
  ] },
  { label: 'Platform', items: [
    { to: '/platform/health', label: 'System health', icon: 'jobs' },
    { to: '/platform/notifications', label: 'Notifications', icon: 'notification' },
    { to: '/platform/jobs', label: 'Background jobs', icon: 'jobs' },
    { to: '/platform/audit', label: 'Audit log', icon: 'audit' },
    { to: '/platform/team', label: 'Admin team', icon: 'team' },
    { to: '/platform/settings', label: 'Settings', icon: 'settings' },
  ] },
];

export default function Shell() {
  const { admin, signOut } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const location = useLocation();
  const canSearch = admin?.role !== 'growth';

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearch(true);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {drawer && <button className="fixed inset-0 z-30 bg-navy/40 lg:hidden" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
      <aside className={`app-sidebar ${drawer ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="brand-mark brand-mark-small"><span>D</span></div>
          <div><div className="font-heading text-lg font-extrabold leading-none text-white">Detour</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Operations OS</div></div>
          <button className="ml-auto text-white/60 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close"><Icon name="close" className="h-5 w-5" /></button>
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-5 pt-4" aria-label="Admin navigation">
          {NAV.map((group) => {
            const visibleItems = group.items.filter((item) => canAccessPath(admin?.role, item.to));
            if (visibleItems.length === 0) return null;
            return (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35">{group.label}</p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    <Icon name={item.icon} className="h-[17px] w-[17px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge === 'critical' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-danger" />}
                  </NavLink>
                ))}
              </div>
            </div>
          );})}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-white">{admin?.email?.slice(0, 1).toUpperCase() ?? 'A'}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{admin?.email}</p><p className="mt-0.5 text-[10px] capitalize text-white/45">{admin?.role} · MFA</p></div>
            <button className="text-[10px] font-bold text-white/55 hover:text-white" onClick={() => void signOut()}>OUT</button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        <header className="app-topbar">
          <button className="icon-button lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}><Icon name="menu" className="h-5 w-5" /></button>
          {canSearch ? <button className="search-trigger" onClick={() => setSearch(true)}>
            <Icon name="search" className="h-4 w-4" />
            <span>Search travelers, trips, leads…</span>
            <kbd>⌘ K</kbd>
          </button> : <div className="text-xs text-muted">Growth workspace</div>}
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted sm:flex"><span className="h-2 w-2 rounded-full bg-success" /> Secure session</div>
        </header>
        <main className="min-h-[calc(100vh-64px)]"><Outlet /></main>
      </div>

      {canSearch && <GlobalSearch open={search} onClose={() => setSearch(false)} />}
    </div>
  );
}
