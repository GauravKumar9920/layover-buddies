import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthBoundary, AuthProvider, useAuth } from '@/auth/AuthProvider';
import Shell from '@/components/Shell';
import Icon from '@/components/Icon';
import { canAccessPath } from '@/lib/permissions';
import OverviewPage from '@/pages/Overview';
import { BookingDetailPage, BookingListPage, DisputesPage, LeadsPage } from '@/pages/Operations';
import { MarketplaceCapabilityPage, PeoplePage, UserDetailPage } from '@/pages/Marketplace';
import { ReportsPage, SosPage, TrustCapabilityPage } from '@/pages/TrustSafety';
import { CancellationsPage, LedgerPage, MoneyListPage, PricingPage } from '@/pages/Money';
import { ContentPage, GrowthPage } from '@/pages/Growth';
import { AuditPage, HealthPage, PlatformSettingsPage, TeamPage } from '@/pages/Platform';

export default function App() {
  return <AuthProvider><AuthBoundary><AdminRoutes /></AuthBoundary></AuthProvider>;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Guard><OverviewPage /></Guard>} />

        <Route path="operations/leads" element={<Guard><LeadsPage /></Guard>} />
        <Route path="operations/inquiries" element={<Guard><BookingListPage view="inquiries" /></Guard>} />
        <Route path="operations/bookings" element={<Guard><BookingListPage /></Guard>} />
        <Route path="operations/bookings/:id" element={<Guard><BookingDetailPage /></Guard>} />
        <Route path="operations/live" element={<Guard><BookingListPage view="live" /></Guard>} />
        <Route path="operations/disputes" element={<Guard><DisputesPage /></Guard>} />

        <Route path="marketplace/travelers" element={<Guard><PeoplePage role="traveler" /></Guard>} />
        <Route path="marketplace/buddies" element={<Guard><PeoplePage role="guide" /></Guard>} />
        <Route path="marketplace/users/:id" element={<Guard><UserDetailPage /></Guard>} />
        <Route path="marketplace/itineraries" element={<Guard><MarketplaceCapabilityPage kind="itineraries" /></Guard>} />
        <Route path="marketplace/reviews" element={<Guard><MarketplaceCapabilityPage kind="reviews" /></Guard>} />

        <Route path="trust/sos" element={<Guard><SosPage /></Guard>} />
        <Route path="trust/reports" element={<Guard><ReportsPage /></Guard>} />
        <Route path="trust/access" element={<Guard><TrustCapabilityPage kind="access" /></Guard>} />
        <Route path="trust/deletions" element={<Guard><TrustCapabilityPage kind="deletions" /></Guard>} />

        <Route path="money/ledger" element={<Guard><LedgerPage /></Guard>} />
        <Route path="money/cancellations" element={<Guard><CancellationsPage /></Guard>} />
        <Route path="money/refunds" element={<Guard><MoneyListPage kind="refunds" /></Guard>} />
        <Route path="money/payouts" element={<Guard><MoneyListPage kind="payouts" /></Guard>} />
        <Route path="money/pricing" element={<Guard><PricingPage /></Guard>} />

        <Route path="growth" element={<Guard><GrowthPage /></Guard>} />
        <Route path="content" element={<Guard><ContentPage /></Guard>} />

        <Route path="platform/health" element={<Guard><HealthPage /></Guard>} />
        <Route path="platform/notifications" element={<Guard><HealthPage focus="notifications" /></Guard>} />
        <Route path="platform/jobs" element={<Guard><HealthPage focus="jobs" /></Guard>} />
        <Route path="platform/audit" element={<Guard><AuditPage /></Guard>} />
        <Route path="platform/team" element={<Guard><TeamPage /></Guard>} />
        <Route path="platform/settings" element={<Guard><PlatformSettingsPage /></Guard>} />

        <Route path="users" element={<Navigate to="/marketplace/travelers" replace />} />
        <Route path="bookings" element={<Navigate to="/operations/bookings" replace />} />
        <Route path="revenue" element={<Navigate to="/money/ledger" replace />} />
        <Route path="sos" element={<Navigate to="/trust/sos" replace />} />
        <Route path="reports" element={<Navigate to="/trust/reports" replace />} />
        <Route path="cancellations" element={<Navigate to="/money/cancellations" replace />} />
        <Route path="payouts" element={<Navigate to="/money/payouts" replace />} />
        <Route path="settings" element={<Navigate to="/platform/settings" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  const location = useLocation();
  if (!canAccessPath(admin?.role, location.pathname)) return <Forbidden />;
  return <>{children}</>;
}

function Forbidden() {
  const { admin } = useAuth();
  return <div className="page-wrap"><div className="page-content flex min-h-[70vh] items-center justify-center"><section className="max-w-md text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger"><Icon name="shield" className="h-7 w-7" /></div><h1 className="mt-5 font-heading text-2xl font-extrabold">This area isn’t in your role</h1><p className="mt-2 text-sm leading-6 text-muted">You’re signed in as <strong className="capitalize text-ink">{admin?.role}</strong>. The navigation hides out-of-role tools, and this deep link remains fail-closed. Ask an owner if your responsibilities changed.</p><a className="primary-button mt-6" href="/overview">Return to overview</a></section></div></div>;
}

function NotFound() {
  return <div className="page-wrap"><div className="page-content flex min-h-[70vh] items-center justify-center"><section className="text-center"><p className="eyebrow">404</p><h1 className="mt-2 font-heading text-3xl font-extrabold">That admin view doesn’t exist</h1><a className="primary-button mt-6" href="/overview">Return to overview</a></section></div></div>;
}
