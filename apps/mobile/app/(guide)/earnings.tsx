// ============================================================================
// Earnings — guide payout summary + dispatch history
// ============================================================================
// Reached from the dashboard's "Earned" stat card (registered off the tab
// bar). Three summary numbers up top (earned / in pipeline / paid out), then
// the payout_dispatches ledger grouped by month.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLine } from '@/components/ui/Loading';
import { fetchEarningsSummary, payoutKindLabel, type EarningsSummary, type GuidePayout } from '@/lib/api/earnings';
import { formatPaise } from '@/lib/booking/money';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';

interface PayoutSection {
  title: string;
  data: GuidePayout[];
}

function groupByMonth(payouts: GuidePayout[]): PayoutSection[] {
  const sections = new Map<string, GuidePayout[]>();
  for (const payout of payouts) {
    const key = format(new Date(payout.initiated_at), 'MMMM yyyy');
    const bucket = sections.get(key);
    if (bucket) bucket.push(payout);
    else sections.set(key, [payout]);
  }
  return Array.from(sections, ([title, data]) => ({ title, data }));
}

function SummaryCard({ label, paise, hint, highlight }: {
  label: string;
  paise: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card style={{ flex: 1, padding: 14 }} framed elevation="none">
      <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.monoMed,
          fontSize: 21,
          letterSpacing: -0.5,
          marginTop: 6,
          color: highlight ? theme.colors.primary : theme.colors.text,
        }}
      >
        {formatPaise(paise)}
      </Text>
      {hint ? (
        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const PAYOUT_STATUS_BADGE: Record<GuidePayout['status'], { label: string; variant: 'success' | 'warning' | 'error' }> = {
  sent:    { label: 'Sent',    variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  failed:  { label: 'Failed',  variant: 'error' },
};

export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<GuidePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    // Without this catch a rejected fetch (offline, RLS, 5xx) would leave
    // summary null and render ₹0 across the board as if it were real data.
    try {
      setError(null);
      const result = await fetchEarningsSummary(user.id);
      setSummary(result.summary);
      setPayouts(result.payouts);
    } catch {
      setError("Couldn't load your earnings. Pull to refresh to retry.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function handleRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Earnings" showBack backFallback="/(guide)" />

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, padding: 14 }} framed elevation="none"><SkeletonLine width="60%" /><SkeletonLine width="80%" /></Card>
            <Card style={{ flex: 1, padding: 14 }} framed elevation="none"><SkeletonLine width="60%" /><SkeletonLine width="80%" /></Card>
          </View>
          <Card style={{ padding: 14 }} framed elevation="none">
            <SkeletonLine width="40%" />
            <SkeletonLine width="90%" />
            <SkeletonLine width="70%" />
          </Card>
        </View>
      ) : (
        <SectionList
          sections={groupByMonth(payouts)}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 20 }}>
              {error ? (
                <Card style={{ padding: 14, marginBottom: 12 }} framed elevation="none">
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error }}>
                    {error}
                  </Text>
                </Card>
              ) : null}
              {/* Suppress the ₹0 summary when a fresh load failed with no data —
                  showing zeros there would present a load error as real earnings. */}
              {!error || summary ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <SummaryCard
                      label="Earned to date"
                      paise={summary?.earnedPaise ?? 0}
                      hint={`${summary?.completedTrips ?? 0} trip${(summary?.completedTrips ?? 0) === 1 ? '' : 's'} done`}
                      highlight
                    />
                    <SummaryCard
                      label="In pipeline"
                      paise={summary?.pipelinePaise ?? 0}
                      hint={`${summary?.pipelineTrips ?? 0} trip${(summary?.pipelineTrips ?? 0) === 1 ? '' : 's'} in flight`}
                    />
                  </View>
                  <SummaryCard label="Paid out" paise={summary?.paidOutPaise ?? 0} hint="Dispatched to your UPI" />
                </>
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textMuted, marginBottom: 8, marginTop: 4 }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const badge = PAYOUT_STATUS_BADGE[item.status];
            return (
              <Card style={{ marginBottom: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.text }}>
                      {payoutKindLabel(item.kind)}
                    </Text>
                    <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 4 }}>
                      {format(new Date(item.completed_at ?? item.initiated_at), 'MMM d, yyyy')}
                      {item.tds_paise > 0 ? ` · TDS ${formatPaise(item.tds_paise)}` : ''}
                    </Text>
                    {item.status === 'failed' && item.failed_reason ? (
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.error, marginTop: 4 }}>
                        {item.failed_reason}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 16, color: theme.colors.text }}>
                      {formatPaise(item.net_paise)}
                    </Text>
                    <Badge label={badge.label} variant={badge.variant} />
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="No payouts yet"
              subtitle="Your payouts land here after your first completed trip — the pipeline card above shows what's on the way."
              actionLabel="Set up payout UPI"
              onAction={() => router.push('/(guide)/profile/payout-vpa' as never)}
            />
          }
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
