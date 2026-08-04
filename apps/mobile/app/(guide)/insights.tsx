import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Loading } from "@/components/ui/Loading";
import { theme } from "@/config/theme";
import { fetchGuideDashboardData } from "@/lib/api/guideDashboard";
import { formatPaise } from "@/lib/booking/money";
import { supabase } from "@/lib/supabase";
import type { GuideInsights, GuideOpportunity } from "@/lib/guide/metrics";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function responseLabel(minutes: number | null): string {
  if (minutes === null) return "Not enough data";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hr`;
}

function percentLabel(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export default function GuideInsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [insights, setInsights] = useState<GuideInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Please sign in again.");
      const dashboard = await fetchGuideDashboardData(user.id);
      setInsights(dashboard.insights);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Your insights could not be loaded.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  function refresh() {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <Header title="Insights" showBack backFallback="/(guide)" />
      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: insets.bottom + 36,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ ...theme.typography.eyebrow, color: theme.colors.primary }}>
          Buddy business
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.display,
            fontSize: 29,
            lineHeight: 34,
            letterSpacing: -0.6,
            color: theme.colors.text,
            marginTop: 5,
          }}
        >
          Know what is working.
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 13.5,
            lineHeight: 20,
            color: theme.colors.textSecondary,
            marginTop: 7,
            marginBottom: 18,
          }}
        >
          These numbers come from your real inquiries, trips, reviews, and
          payouts. Open conversations are not counted against conversion.
        </Text>

        {error ? (
          <Card style={{ marginBottom: 16, borderColor: "rgba(184,64,51,0.35)" }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error }}>
              {error}
            </Text>
          </Card>
        ) : null}

        {insights ? (
          <>
            <SectionLabel>This month</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <SnapshotCard
                icon="message-circle"
                value={String(insights.thisMonth.inquiries)}
                label="New inquiries"
              />
              <SnapshotCard
                icon="check-circle"
                value={String(insights.thisMonth.completedTrips)}
                label="Trips completed"
              />
              <SnapshotCard
                icon="users"
                value={String(insights.thisMonth.travelersHosted)}
                label="Travelers hosted"
              />
              <SnapshotCard
                icon="trending-up"
                value={formatPaise(insights.thisMonth.earnedPaise)}
                label="Net earnings"
                highlight
              />
            </View>

            <SectionLabel>Performance</SectionLabel>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <MetricRow
                icon="target"
                label="Booking conversion"
                value={percentLabel(insights.performance.conversionRate)}
                detail={
                  insights.performance.conversionSample > 0
                    ? `Across ${insights.performance.conversionSample} resolved inquiries`
                    : "Appears after your first resolved inquiry"
                }
                tone="primary"
              />
              <Divider />
              <MetricRow
                icon="clock"
                label="Average reply"
                value={responseLabel(insights.performance.responseTimeMinutes)}
                detail="Profile response-time signal"
              />
              <Divider />
              <MetricRow
                icon="star"
                label="Traveler rating"
                value={
                  insights.performance.totalReviews
                    ? `${insights.performance.avgRating.toFixed(1)} / 5`
                    : "New guide"
                }
                detail={`${insights.performance.totalReviews} verified review${insights.performance.totalReviews === 1 ? "" : "s"}`}
              />
              <Divider />
              <MetricRow
                icon="shield"
                label="Guide cancellation rate"
                value={percentLabel(
                  insights.performance.guideCancellationRate,
                )}
                detail={
                  insights.performance.cancellationSample > 0
                    ? `Across ${insights.performance.cancellationSample} guide-controlled outcomes`
                    : "No eligible trip outcomes yet"
                }
                tone={
                  (insights.performance.guideCancellationRate ?? 0) > 0
                    ? "warning"
                    : "default"
                }
              />
            </Card>

            <SectionLabel>Hosting footprint</SectionLabel>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <FootprintRow
                label="Completed Detours"
                value={String(insights.allTime.completedTrips)}
              />
              <Divider />
              <FootprintRow
                label="Travelers hosted"
                value={String(insights.allTime.travelersHosted)}
              />
              <Divider />
              <FootprintRow
                label="Repeat travelers"
                value={String(insights.allTime.repeatTravelers)}
              />
              <Divider />
              <FootprintRow
                label="Published experiences"
                value={`${insights.tours.published} / ${insights.tours.total}`}
              />
              <Divider />
              <FootprintRow
                label="Net earned to date"
                value={formatPaise(insights.allTime.earnedPaise)}
                highlight
                onPress={() => router.push("/(guide)/earnings" as never)}
              />
            </Card>

            {insights.tours.topTour ? (
              <>
                <SectionLabel>Top experience</SectionLabel>
                <Card
                  onPress={() =>
                    router.push(
                      `/(guide)/itineraries/${insights.tours.topTour?.id}` as never,
                    )
                  }
                  style={{ flexDirection: "row", alignItems: "center", gap: 13 }}
                  framed
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: "rgba(232,159,44,0.18)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="award" size={20} color={theme.colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: theme.fonts.bodyBold,
                        fontSize: 14.5,
                        color: theme.colors.text,
                      }}
                    >
                      {insights.tours.topTour.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.fonts.body,
                        fontSize: 12,
                        color: theme.colors.textSecondary,
                        marginTop: 3,
                      }}
                    >
                      {insights.tours.topTour.completedTrips} completed trip
                      {insights.tours.topTour.completedTrips === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
                </Card>
              </>
            ) : null}

            {insights.opportunities.length > 0 ? (
              <>
                <SectionLabel>Next moves</SectionLabel>
                <View style={{ gap: 10 }}>
                  {insights.opportunities.map((opportunity, index) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      number={index + 1}
                      onPress={() => router.push(opportunity.route as never)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...theme.typography.eyebrow,
        color: theme.colors.textMuted,
        marginTop: 22,
        marginBottom: 9,
      }}
    >
      {children}
    </Text>
  );
}

function SnapshotCard({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: FeatherName;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Card style={{ width: "48%", minHeight: 112, justifyContent: "space-between" }} framed elevation="none">
      <Feather
        name={icon}
        size={17}
        color={highlight ? theme.colors.primary : theme.colors.textSecondary}
      />
      <View style={{ marginTop: 14 }}>
        <Text
          style={{
            fontFamily: theme.fonts.monoMed,
            fontSize: value.length > 8 ? 18 : 23,
            color: highlight ? theme.colors.primary : theme.colors.text,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: theme.colors.textMuted,
            marginTop: 5,
          }}
        >
          {label}
        </Text>
      </View>
    </Card>
  );
}

function MetricRow({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: FeatherName;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "primary" | "warning";
}) {
  const valueColor =
    tone === "primary"
      ? theme.colors.primary
      : tone === "warning"
        ? theme.colors.error
        : theme.colors.text;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 13, padding: 15 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Feather name={icon} size={17} color={theme.colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13.5, color: theme.colors.text }}>
          {label}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.textMuted, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: value.length > 10 ? 11 : 16, color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}

function FootprintRow({
  label,
  value,
  highlight = false,
  onPress,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={{ flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: 13.5, color: theme.colors.text }}>
        {label}
      </Text>
      <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 14, color: highlight ? theme.colors.primary : theme.colors.text }}>
        {value}
      </Text>
      {onPress ? <Feather name="chevron-right" size={17} color={theme.colors.textMuted} /> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 15 }}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 15 }}>{content}</View>;
}

function OpportunityCard({
  opportunity,
  number,
  onPress,
}: {
  opportunity: GuideOpportunity;
  number: number;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 13, color: "#FCF7EA" }}>
          {number}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.text }}>
          {opportunity.title}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 3 }}>
          {opportunity.detail}
        </Text>
      </View>
      <Feather name="arrow-right" size={17} color={theme.colors.primary} />
    </Card>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: theme.colors.divider }} />;
}
