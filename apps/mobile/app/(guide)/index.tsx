import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isToday, isTomorrow } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { theme } from "@/config/theme";
import { fetchGuideBookings } from "@/lib/api/bookings";
import { setGuideAvailability } from "@/lib/api/guides";
import {
  fetchMyGuideDashboardSummary,
  type GuideDashboardSummary,
} from "@/lib/api/guideDashboard";
import { fetchUnreadCounts } from "@/lib/api/messages";
import { getBookingCta } from "@/lib/booking/cta";
import { formatPaise } from "@/lib/booking/money";
import {
  isActiveBookingState,
  isUpcomingBookingState,
} from "@/lib/booking/stateMachine";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types";
import type { BookingState } from "@/lib/booking/stateMachine";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface DashboardAction {
  booking: Booking;
  label: string;
  detail: string;
  route: string;
  icon: FeatherName;
  tone: "primary" | "warning" | "message";
  priority: number;
}

interface LaunchStep {
  label: string;
  detail: string;
  complete: boolean;
  route: string;
  icon: FeatherName;
}

const REQUEST_STATES = new Set<BookingState>(["chat_open"]);
const UP_NEXT_EXCLUDED_STATES = new Set<BookingState>([
  "chat_open",
  "pending",
  "awaiting_proofs",
  "reconciling",
]);

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bookingTime(booking: Booking): number {
  return validDate(booking.start_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function isScheduledTodayOrLater(booking: Booking): boolean {
  const date = validDate(booking.start_date);
  return date !== null && (isToday(date) || date.getTime() > Date.now());
}

function formatBookingMoment(value: string): string {
  const date = validDate(value);
  if (!date) return "Time to confirm";
  if (isToday(date)) return `Today · ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, "h:mm a")}`;
  return format(date, "EEE, MMM d · h:mm a");
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function itineraryImage(booking: Booking | null): string | null {
  if (!booking?.itinerary) return null;
  return (
    booking.itinerary.cover_image_url ?? booking.itinerary.image_url ?? null
  );
}

function travelerName(booking: Booking): string {
  return booking.traveler?.name?.trim() || "Traveler";
}

function tourName(booking: Booking): string {
  return booking.itinerary?.name?.trim() || "Custom Detour";
}

function fillBookingRoute(pathname: string, bookingId: string): string {
  return pathname.replace("[bookingId]", bookingId).replace("[id]", bookingId);
}

function pickUpNext(bookings: Booking[]): Booking | null {
  const tripInProgress = bookings.find(
    (booking) => booking.status === "in_progress",
  );
  if (tripInProgress) return tripInProgress;

  const tripReady = bookings
    .filter(
      (booking) =>
        booking.status === "trip_ready" && isScheduledTodayOrLater(booking),
    )
    .sort((a, b) => bookingTime(a) - bookingTime(b))[0];
  if (tripReady) return tripReady;

  const candidates = bookings
    .filter(
      (booking) =>
        isUpcomingBookingState(booking.status) &&
        !UP_NEXT_EXCLUDED_STATES.has(booking.status) &&
        isScheduledTodayOrLater(booking),
    )
    .sort((a, b) => bookingTime(a) - bookingTime(b));

  return candidates[0] ?? null;
}

function buildDashboardActions(
  bookings: Booking[],
  unreadCounts: Record<string, number>,
): DashboardAction[] {
  return bookings
    .flatMap((booking): DashboardAction[] => {
      if (!isActiveBookingState(booking.status)) return [];

      const unread = unreadCounts[booking.id] ?? 0;
      const person = travelerName(booking);
      const itinerary = tourName(booking);

      // An open inquiry remains conversation-first. The guide continues
      // planning in chat instead of jumping straight into an agreement.
      if (REQUEST_STATES.has(booking.status)) {
        return [
          {
            booking,
            label: unread > 0 ? `Reply to ${person}` : "Continue planning",
            detail: `${unread > 0 ? `${unread} unread · ` : ""}${itinerary}`,
            route: `/(shared)/messages/${booking.id}`,
            icon: "message-circle",
            tone: unread > 0 ? "message" : "primary",
            priority: unread > 0 ? 20 : 30,
          },
        ];
      }

      const cta = getBookingCta(booking.status, "buddy");
      const scheduledDate = validDate(booking.start_date);
      const tripReadyBeforeTripDay =
        booking.status === "trip_ready" &&
        (scheduledDate === null || !isToday(scheduledDate));
      if (
        !tripReadyBeforeTripDay &&
        cta.label &&
        cta.route &&
        !cta.disabled &&
        (cta.variant === "primary" || cta.variant === "warning")
      ) {
        return [
          {
            booking,
            label: cta.label,
            detail: `${person} · ${itinerary}`,
            route: fillBookingRoute(cta.route.pathname, booking.id),
            icon:
              booking.status === "trip_ready"
                ? "maximize"
                : booking.status === "awaiting_proofs"
                  ? "file-text"
                  : "check-square",
            tone: cta.variant === "warning" ? "warning" : "primary",
            priority:
              booking.status === "trip_ready"
                ? 0
                : booking.status === "awaiting_proofs"
                  ? 5
                  : 10,
          },
        ];
      }

      if (unread > 0) {
        return [
          {
            booking,
            label: `Reply to ${person}`,
            detail: `${unread} unread · ${itinerary}`,
            route: `/(shared)/messages/${booking.id}`,
            icon: "message-circle",
            tone: "message",
            priority: 25,
          },
        ];
      }

      return [];
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        bookingTime(a.booking) - bookingTime(b.booking),
    );
}

export default function GuideDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<GuideDashboardSummary | null>(null);
  const [guideName, setGuideName] = useState("Guide");
  const [guideUserId, setGuideUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        throw new Error("Please sign in again to view your guide home.");

      const [userResult, bookingData, dashboardSummary] = await Promise.all([
        supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
        fetchGuideBookings(user.id),
        fetchMyGuideDashboardSummary(),
      ]);

      if (userResult.error) throw userResult.error;

      const activeIds = bookingData
        .filter((booking) => isActiveBookingState(booking.status))
        .map((booking) => booking.id);
      const counts =
        activeIds.length > 0 ? await fetchUnreadCounts(activeIds) : {};

      const fullName =
        userResult.data?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        "Guide";

      setGuideUserId(user.id);
      setGuideName(fullName.trim().split(/\s+/)[0] || "Guide");
      setBookings(bookingData);
      setSummary(dashboardSummary);
      setUnreadCounts(counts);
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load your guide home. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    void loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleAvailabilityPress = useCallback(async () => {
    if (!summary || availabilityBusy) return;

    const nextValue = !summary.acceptingInquiries;
    if (
      nextValue &&
      (!summary.profilePublished || summary.profileCompletionPercent < 100)
    ) {
      const missing =
        summary.profileMissingFields.length > 0
          ? ` Finish: ${summary.profileMissingFields.slice(0, 3).join(", ")}.`
          : "";
      Alert.alert(
        "Complete your profile first",
        `Travelers can send inquiries after your profile passes its publication check.${missing}`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Complete profile",
            onPress: () => router.push("/(guide)/profile/edit" as never),
          },
        ],
      );
      return;
    }

    setAvailabilityBusy(true);
    setSummary((current) =>
      current ? { ...current, acceptingInquiries: nextValue } : current,
    );
    try {
      await setGuideAvailability(nextValue);
    } catch (error: unknown) {
      setSummary((current) =>
        current ? { ...current, acceptingInquiries: !nextValue } : current,
      );
      Alert.alert(
        "Unable to update availability",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAvailabilityBusy(false);
    }
  }, [availabilityBusy, router, summary]);

  const upNext = useMemo(() => pickUpNext(bookings), [bookings]);
  const actions = useMemo(
    () => buildDashboardActions(bookings, unreadCounts),
    [bookings, unreadCounts],
  );
  const tripDayBooking =
    upNext &&
    (upNext.status === "in_progress" ||
      (upNext.status === "trip_ready" &&
        validDate(upNext.start_date) !== null &&
        isToday(validDate(upNext.start_date) as Date)))
      ? upNext
      : null;

  if (loading)
    return <Loading fullScreen message="Preparing your guide home…" />;

  if (!summary) {
    return (
      <DashboardLoadError
        insetsTop={insets.top}
        message={loadError ?? "We could not load your guide home."}
        onRetry={() => {
          setLoading(true);
          void loadData().finally(() => setLoading(false));
        }}
      />
    );
  }

  const hasBookingActivity = bookings.some(
    (booking) =>
      isActiveBookingState(booking.status) ||
      booking.status === "completed" ||
      booking.status === "rated",
  );
  const hasMarketplaceActivity =
    hasBookingActivity ||
    summary.openInquiries > 0 ||
    summary.upcomingTrips > 0 ||
    summary.completedTrips > 0 ||
    summary.paidEarningsTotalPaise > 0;
  const isNewGuide = !hasMarketplaceActivity;
  const profilePercent = Math.max(
    0,
    Math.min(100, Math.round(summary.profileCompletionPercent)),
  );
  const launchSteps: LaunchStep[] = [
    {
      label: "Build your public profile",
      detail: summary.profilePublished
        ? `${profilePercent}% complete · Published`
        : `${profilePercent}% complete · Not published`,
      complete: summary.profilePublished && profilePercent === 100,
      route: "/(guide)/profile/edit",
      icon: "user",
    },
    {
      label: "Open for inquiries",
      detail: summary.acceptingInquiries
        ? "Travelers can start planning with you"
        : "Turn this on when you are ready to reply",
      complete: summary.acceptingInquiries,
      route: "/(guide)/profile/edit",
      icon: "radio",
    },
    {
      label: "Publish your first tour",
      detail:
        summary.activeTours > 0
          ? `${summary.activeTours} active tour${summary.activeTours === 1 ? "" : "s"}`
          : "Give travelers a concrete way to explore Mumbai",
      complete: summary.activeTours > 0,
      route: "/(guide)/itineraries/create",
      icon: "map",
    },
  ];

  const headerEyebrow = tripDayBooking
    ? "Trip day"
    : isNewGuide
      ? "Your guide home"
      : "Guide home";
  const headerTitle = tripDayBooking
    ? `Today's the day, ${guideName}`
    : isNewGuide
      ? `Let's get you live, ${guideName}`
      : `${greetingForNow()}, ${guideName}`;
  const headerSubtitle = tripDayBooking
    ? `${travelerName(tripDayBooking)} is counting on you. Everything for the day is below.`
    : !summary.acceptingInquiries
      ? "Incoming inquiries are paused. Your existing trips and actions stay here."
      : summary.openInquiries > 0
        ? `${summary.openInquiries} open inquir${summary.openInquiries === 1 ? "y is" : "ies are"} in planning.`
        : isNewGuide
          ? "Complete the essentials, preview your profile, then welcome your first traveler."
          : "Your trips, next actions and honest progress in one place.";

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>{headerEyebrow}</Text>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
          </View>
          <AvailabilityPill
            accepting={summary.acceptingInquiries}
            busy={availabilityBusy}
            onPress={handleAvailabilityPress}
          />
        </View>
        <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <Card style={styles.refreshError} framed elevation="none">
            <Feather name="wifi-off" size={17} color={theme.colors.error} />
            <Text style={styles.refreshErrorText}>
              Could not refresh. Showing the last loaded dashboard.
            </Text>
          </Card>
        ) : null}

        {tripDayBooking ? (
          <TripDayCard
            booking={tripDayBooking}
            onOpen={(route) => router.push(route as never)}
          />
        ) : isNewGuide ? (
          <LaunchChecklist
            steps={launchSteps}
            profilePercent={profilePercent}
            onOpen={(route) => router.push(route as never)}
          />
        ) : upNext ? (
          <UpNextCard
            booking={upNext}
            onOpenBooking={() =>
              router.push(`/(guide)/bookings/${upNext.id}` as never)
            }
            onMessage={() =>
              router.push(`/(shared)/messages/${upNext.id}` as never)
            }
          />
        ) : (
          <NoTripScheduledCard
            onCreateTour={() =>
              router.push("/(guide)/itineraries/create" as never)
            }
          />
        )}

        {actions.length > 0 ? (
          <NeedsYouSection
            actions={actions}
            onOpen={(route) => router.push(route as never)}
          />
        ) : !isNewGuide ? (
          <AllCaughtUpCard />
        ) : null}

        {!isNewGuide ? (
          <>
            <SectionHeading
              eyebrow="At a glance"
              title="Your work, clearly"
              detail="Live totals with no invented trends."
            />
            <View style={styles.metricGrid}>
              <MetricCard
                icon="message-circle"
                label="Open inquiries"
                value={String(summary.openInquiries)}
                detail="in planning"
                tint={theme.colors.primaryLight}
                color={theme.colors.primaryDark}
              />
              <MetricCard
                icon="calendar"
                label="Upcoming"
                value={String(summary.upcomingTrips)}
                detail="on your calendar"
                tint={theme.colors.accentLight}
                color={theme.colors.accentDark}
              />
              <MetricCard
                icon="check-circle"
                label="Completed"
                value={String(summary.completedTrips)}
                detail="all time"
                tint="#E2F1E7"
                color={theme.colors.success}
              />
              <MetricCard
                icon="credit-card"
                label="Paid this month"
                value={formatPaise(summary.paidEarningsMonthPaise)}
                detail="sent earnings"
                tint="#F8E8C6"
                color="#9B6500"
                compact
              />
            </View>
          </>
        ) : null}

        <MomentumCard
          summary={summary}
          profilePercent={profilePercent}
          onOpenEarnings={() => router.push("/(guide)/earnings" as never)}
          onImproveProfile={() => router.push("/(guide)/profile/edit" as never)}
        />

        <SectionHeading
          eyebrow="Quick actions"
          title="Keep the momentum"
          detail="The places guides use most."
        />
        <View style={styles.quickActions}>
          <QuickAction
            icon="plus-circle"
            label="Create tour"
            color={theme.colors.primary}
            tint={theme.colors.primaryLight}
            onPress={() => router.push("/(guide)/itineraries/create" as never)}
          />
          <QuickAction
            icon="sliders"
            label="Profile & availability"
            color={theme.colors.accent}
            tint={theme.colors.accentLight}
            onPress={() => router.push("/(guide)/profile" as never)}
          />
          {/* Entry point for the business-performance screen. The cockpit above
              carries live counters; insights carries the trend behind them. */}
          <QuickAction
            icon="trending-up"
            label="Business insights"
            color={theme.colors.gold}
            tint="#FBEACB"
            onPress={() => router.push("/(guide)/insights" as never)}
          />
          <QuickAction
            icon="eye"
            label="Preview as traveler"
            color={theme.colors.purple}
            tint="#EEE8FA"
            disabled={!guideUserId}
            onPress={() =>
              guideUserId &&
              router.push(`/(traveler)/guide/${guideUserId}` as never)
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

function AvailabilityPill({
  accepting,
  busy,
  onPress,
}: {
  accepting: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        busy
          ? "Updating inquiry availability"
          : accepting
            ? "Accepting inquiries. Pause inquiries."
            : "Inquiries paused. Resume inquiries."
      }
      accessibilityState={{ busy, disabled: busy }}
      activeOpacity={0.82}
      disabled={busy}
      onPress={onPress}
      style={[
        styles.availabilityPill,
        {
          backgroundColor: accepting
            ? "rgba(61,139,90,0.18)"
            : "rgba(252,247,234,0.10)",
          borderColor: accepting
            ? "rgba(129,211,157,0.55)"
            : "rgba(252,247,234,0.24)",
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#FCF7EA" />
      ) : (
        <View
          style={[
            styles.availabilityDot,
            {
              backgroundColor: accepting ? "#7ED39B" : "rgba(252,247,234,0.56)",
            },
          ]}
        />
      )}
      <Text style={styles.availabilityText}>
        {busy ? "Updating…" : accepting ? "Inquiries open" : "Inquiries paused"}
      </Text>
      <Feather
        name={accepting ? "toggle-right" : "toggle-left"}
        size={13}
        color="rgba(252,247,234,0.76)"
      />
    </TouchableOpacity>
  );
}

function LaunchChecklist({
  steps,
  profilePercent,
  onOpen,
}: {
  steps: LaunchStep[];
  profilePercent: number;
  onOpen: (route: string) => void;
}) {
  const completeCount = steps.filter((step) => step.complete).length;
  const firstIncomplete = steps.find((step) => !step.complete);

  return (
    <Card style={styles.launchCard} framed>
      <View style={styles.launchHeadingRow}>
        <View style={styles.launchMark}>
          <Text style={styles.launchStar}>★</Text>
        </View>
        <View style={styles.launchHeadingCopy}>
          <Text style={styles.cardEyebrow}>Launch checklist</Text>
          <Text style={styles.launchTitle}>
            {completeCount === steps.length
              ? "You're live and ready"
              : "Your first inquiry starts here"}
          </Text>
          <Text style={styles.launchDetail}>
            {completeCount} of {steps.length} essentials ready
          </Text>
        </View>
      </View>

      <View style={styles.launchProgressTrack}>
        <View
          style={[
            styles.launchProgressFill,
            { width: `${(completeCount / steps.length) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.launchSteps}>
        {steps.map((step, index) => (
          <TouchableOpacity
            key={step.label}
            accessibilityRole="button"
            accessibilityLabel={`${step.label}. ${step.complete ? "Complete" : step.detail}`}
            activeOpacity={0.78}
            onPress={() => onOpen(step.route)}
            style={[
              styles.launchStep,
              index < steps.length - 1 ? styles.rowDivider : undefined,
            ]}
          >
            <View
              style={[
                styles.launchStepIcon,
                {
                  backgroundColor: step.complete
                    ? "#E2F1E7"
                    : theme.colors.surfaceMuted,
                },
              ]}
            >
              <Feather
                name={step.complete ? "check" : step.icon}
                size={16}
                color={
                  step.complete
                    ? theme.colors.success
                    : theme.colors.textSecondary
                }
              />
            </View>
            <View style={styles.launchStepCopy}>
              <Text style={styles.launchStepLabel}>{step.label}</Text>
              <Text style={styles.launchStepDetail}>{step.detail}</Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>

      {firstIncomplete ? (
        <Button
          title={
            firstIncomplete.icon === "map"
              ? "Create your first tour"
              : profilePercent < 100
                ? "Continue setup"
                : firstIncomplete.label
          }
          onPress={() => onOpen(firstIncomplete.route)}
          icon={<Feather name="arrow-right" size={16} color="#FCF7EA" />}
        />
      ) : (
        <Text style={styles.launchReadyNote}>
          Keep your profile fresh and reply thoughtfully when your first inquiry
          arrives.
        </Text>
      )}
    </Card>
  );
}

function TripDayCard({
  booking,
  onOpen,
}: {
  booking: Booking;
  onOpen: (route: string) => void;
}) {
  const imageUrl = itineraryImage(booking);
  const cta = getBookingCta(booking.status, "buddy");
  const ctaRoute = cta.route
    ? fillBookingRoute(cta.route.pathname, booking.id)
    : `/(guide)/bookings/${booking.id}`;

  return (
    <Card style={styles.featureCard} padding={0} framed>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.featureImage}
          contentFit="cover"
          transition={220}
        />
      ) : (
        <BrandedTourFallback label="Trip day" />
      )}
      <View style={styles.featureContent}>
        <View style={styles.featureStatusRow}>
          <View style={styles.tripDayPill}>
            <View style={styles.tripDayDot} />
            <Text style={styles.tripDayPillText}>
              {booking.status === "in_progress"
                ? "In progress"
                : "Ready to meet"}
            </Text>
          </View>
          <Text style={styles.featureDate}>
            {formatBookingMoment(booking.start_date)}
          </Text>
        </View>
        <Text style={styles.featureTitle}>
          Your Detour with {travelerName(booking)}
        </Text>
        <Text style={styles.featureSubtitle}>{tourName(booking)}</Text>
        {booking.flight_number ? (
          <View style={styles.flightRow}>
            <Feather
              name="navigation"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.flightText}>
              Arrival flight {booking.flight_number}
            </Text>
          </View>
        ) : null}
        <View style={styles.featureButtons}>
          <Button
            title={cta.label || "Open trip"}
            onPress={() => onOpen(ctaRoute)}
            style={styles.featureButton}
          />
          <Button
            title="Message"
            variant="secondary"
            onPress={() => onOpen(`/(shared)/messages/${booking.id}`)}
            style={styles.featureButton}
          />
        </View>
      </View>
    </Card>
  );
}

function UpNextCard({
  booking,
  onOpenBooking,
  onMessage,
}: {
  booking: Booking;
  onOpenBooking: () => void;
  onMessage: () => void;
}) {
  const imageUrl = itineraryImage(booking);
  const cta = getBookingCta(booking.status, "buddy");

  return (
    <Card style={styles.featureCard} padding={0} framed>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.featureImage}
          contentFit="cover"
          transition={220}
        />
      ) : (
        <BrandedTourFallback label="Up next" />
      )}
      <View style={styles.featureContent}>
        <View style={styles.featureStatusRow}>
          <Text style={styles.cardEyebrow}>Up next</Text>
          <Text style={styles.featureDate}>
            {formatBookingMoment(booking.start_date)}
          </Text>
        </View>
        <Text style={styles.featureTitle}>{travelerName(booking)}</Text>
        <Text style={styles.featureSubtitle}>{tourName(booking)}</Text>
        {booking.flight_number ? (
          <View style={styles.flightRow}>
            <Feather
              name="navigation"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.flightText}>
              Arrival flight {booking.flight_number}
            </Text>
          </View>
        ) : null}
        {cta.label ? (
          <View style={styles.nextStepRow}>
            <Text style={styles.nextStepLabel}>Next step</Text>
            <Text style={styles.nextStepValue}>{cta.label}</Text>
          </View>
        ) : null}
        <View style={styles.featureButtons}>
          <Button
            title="Open trip"
            onPress={onOpenBooking}
            style={styles.featureButton}
          />
          <Button
            title="Message"
            variant="secondary"
            onPress={onMessage}
            style={styles.featureButton}
          />
        </View>
      </View>
    </Card>
  );
}

function BrandedTourFallback({ label }: { label: string }) {
  return (
    <LinearGradient colors={theme.gradients.sea} style={styles.fallback}>
      <View style={styles.fallbackOrbLarge} />
      <View style={styles.fallbackOrbSmall} />
      <View style={styles.fallbackIcon}>
        <Feather name="map-pin" size={24} color="#FCF7EA" />
      </View>
      <Text style={styles.fallbackEyebrow}>Detour · Mumbai</Text>
      <Text style={styles.fallbackLabel}>{label}</Text>
    </LinearGradient>
  );
}

function NoTripScheduledCard({ onCreateTour }: { onCreateTour: () => void }) {
  return (
    <Card style={styles.noTripCard} framed elevation="none">
      <View style={styles.noTripIcon}>
        <Feather name="calendar" size={20} color={theme.colors.accentDark} />
      </View>
      <View style={styles.noTripCopy}>
        <Text style={styles.noTripTitle}>No trip scheduled yet</Text>
        <Text style={styles.noTripDetail}>
          Your next confirmed Detour will appear here with its traveler and
          meeting details.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Create a new tour"
          onPress={onCreateTour}
          style={styles.inlineLink}
        >
          <Text style={styles.inlineLinkText}>Create a tour</Text>
          <Feather name="arrow-right" size={14} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function NeedsYouSection({
  actions,
  onOpen,
}: {
  actions: DashboardAction[];
  onOpen: (route: string) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeading
        eyebrow={`${actions.length} ${actions.length === 1 ? "action" : "actions"}`}
        title="Needs you"
        detail="One clear next step for each traveler."
      />
      <Card style={styles.actionListCard} padding={0}>
        {actions.map((action, index) => {
          const colors =
            action.tone === "warning"
              ? { tint: "#F8E8C6", color: "#9B6500" }
              : action.tone === "message"
                ? {
                    tint: theme.colors.accentLight,
                    color: theme.colors.accentDark,
                  }
                : {
                    tint: theme.colors.primaryLight,
                    color: theme.colors.primaryDark,
                  };
          return (
            <TouchableOpacity
              key={action.booking.id}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}. ${action.detail}`}
              activeOpacity={0.78}
              onPress={() => onOpen(action.route)}
              style={[
                styles.actionRow,
                index < actions.length - 1 ? styles.rowDivider : undefined,
              ]}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: colors.tint }]}
              >
                <Feather name={action.icon} size={17} color={colors.color} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDetail} numberOfLines={1}>
                  {action.detail}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={19}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </Card>
    </View>
  );
}

function AllCaughtUpCard() {
  return (
    <Card style={styles.caughtUpCard} elevation="none">
      <View style={styles.caughtUpIcon}>
        <Feather name="check" size={17} color={theme.colors.success} />
      </View>
      <View style={styles.caughtUpCopy}>
        <Text style={styles.caughtUpTitle}>All caught up</Text>
        <Text style={styles.caughtUpDetail}>
          No traveler or trip needs an action from you right now.
        </Text>
      </View>
    </Card>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tint,
  color,
  compact = false,
}: {
  icon: FeatherName;
  label: string;
  value: string;
  detail: string;
  tint: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <Card style={styles.metricCard} framed elevation="none">
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[styles.metricValue, compact ? styles.metricValueCompact : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Card>
  );
}

function MomentumCard({
  summary,
  profilePercent,
  onOpenEarnings,
  onImproveProfile,
}: {
  summary: GuideDashboardSummary;
  profilePercent: number;
  onOpenEarnings: () => void;
  onImproveProfile: () => void;
}) {
  const rating =
    summary.averageRating === null ? "New" : summary.averageRating.toFixed(1);
  const reviewDetail =
    summary.reviewCount === 0
      ? "No reviews yet"
      : `${summary.reviewCount} review${summary.reviewCount === 1 ? "" : "s"}`;

  return (
    <View style={styles.section}>
      <SectionHeading
        eyebrow="Momentum"
        title="Build trust over time"
        detail="Reputation, profile readiness and durable earnings."
      />
      <Card style={styles.momentumCard} framed>
        <View style={styles.momentumStats}>
          <MomentumStat
            label="Rating"
            value={rating}
            detail={reviewDetail}
            icon="star"
            color={theme.colors.gold}
          />
          <View style={styles.verticalDivider} />
          <MomentumStat
            label="Active tours"
            value={String(summary.activeTours)}
            detail="visible to travelers"
            icon="map"
            color={theme.colors.accent}
          />
        </View>

        <View style={styles.profileProgressBlock}>
          <View style={styles.profileProgressHeading}>
            <View>
              <Text style={styles.progressLabel}>Public profile</Text>
              <Text style={styles.progressDetail}>
                {summary.profilePublished ? "Published" : "Still in draft"}
              </Text>
            </View>
            <Text style={styles.progressValue}>{profilePercent}%</Text>
          </View>
          <View style={styles.profileProgressTrack}>
            <View
              style={[
                styles.profileProgressFill,
                { width: `${profilePercent}%` },
              ]}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Improve public profile"
            onPress={onImproveProfile}
            style={styles.inlineLink}
          >
            <Text style={styles.inlineLinkText}>Improve profile</Text>
            <Feather
              name="arrow-right"
              size={14}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`View earnings. ${formatPaise(summary.paidEarningsTotalPaise)} paid all time.`}
          activeOpacity={0.8}
          onPress={onOpenEarnings}
          style={styles.earningsRow}
        >
          <View style={styles.earningsIcon}>
            <Feather
              name="credit-card"
              size={16}
              color={theme.colors.success}
            />
          </View>
          <View style={styles.earningsCopy}>
            <Text style={styles.earningsLabel}>Paid all time</Text>
            <Text style={styles.earningsValue}>
              {formatPaise(summary.paidEarningsTotalPaise)}
            </Text>
          </View>
          <Text style={styles.earningsLink}>View earnings</Text>
          <Feather
            name="chevron-right"
            size={17}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </Card>
    </View>
  );
}

function MomentumStat({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: FeatherName;
  color: string;
}) {
  return (
    <View style={styles.momentumStat}>
      <View style={styles.momentumLabelRow}>
        <Feather name={icon} size={14} color={color} />
        <Text style={styles.momentumLabel}>{label}</Text>
      </View>
      <Text style={styles.momentumValue}>{value}</Text>
      <Text style={styles.momentumDetail}>{detail}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  tint,
  onPress,
  disabled = false,
}: {
  icon: FeatherName;
  label: string;
  color: string;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.quickAction, disabled ? styles.disabled : undefined]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={19} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Feather name="arrow-up-right" size={15} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

function DashboardLoadError({
  insetsTop,
  message,
  onRetry,
}: {
  insetsTop: number;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={theme.gradients.hero}
        style={[styles.header, { paddingTop: insetsTop + 14 }]}
      >
        <Text style={styles.headerEyebrow}>Guide home</Text>
        <Text style={styles.headerTitle}>Your cockpit is taking a pause</Text>
        <Text style={styles.headerSubtitle}>
          We will not replace your real guide numbers with guesses.
        </Text>
      </LinearGradient>
      <View style={styles.errorContent}>
        <Card style={styles.errorCard} framed>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={22} color={theme.colors.error} />
          </View>
          <Text style={styles.errorTitle}>Could not load guide home</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <Button title="Try again" onPress={onRetry} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    ...theme.typography.eyebrow,
    color: "rgba(252,247,234,0.64)",
  },
  headerTitle: {
    fontFamily: theme.fonts.displayX,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: "#FCF7EA",
    marginTop: 5,
  },
  headerSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(252,247,234,0.74)",
    marginTop: 10,
    maxWidth: 560,
  },
  availabilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 3,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  availabilityText: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#FCF7EA",
  },
  scrollContent: {
    padding: 16,
  },
  refreshError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    marginBottom: 14,
    borderColor: "rgba(192,57,43,0.42)",
  },
  refreshErrorText: {
    flex: 1,
    fontFamily: theme.fonts.bodyMed,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.error,
  },
  featureCard: {
    overflow: "hidden",
    marginBottom: 20,
  },
  featureImage: {
    width: "100%",
    height: 154,
    backgroundColor: theme.colors.surfaceMuted,
  },
  fallback: {
    height: 154,
    padding: 18,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fallbackOrbLarge: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(252,247,234,0.09)",
    right: -34,
    top: -52,
  },
  fallbackOrbSmall: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(232,159,44,0.24)",
    right: 54,
    bottom: -30,
  },
  fallbackIcon: {
    position: "absolute",
    right: 20,
    top: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,25,41,0.18)",
    borderWidth: 1,
    borderColor: "rgba(252,247,234,0.22)",
  },
  fallbackEyebrow: {
    ...theme.typography.eyebrow,
    color: "rgba(252,247,234,0.70)",
  },
  fallbackLabel: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    color: "#FCF7EA",
    marginTop: 3,
  },
  featureContent: {
    padding: 17,
  },
  featureStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardEyebrow: {
    ...theme.typography.eyebrow,
    color: theme.colors.primaryDark,
  },
  featureDate: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 10.5,
    letterSpacing: 0.25,
    color: theme.colors.textSecondary,
  },
  featureTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 27,
    color: theme.colors.text,
    marginTop: 10,
  },
  featureSubtitle: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  flightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  flightText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    color: theme.colors.textSecondary,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  nextStepLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: theme.colors.textSecondary,
  },
  nextStepValue: {
    flex: 1,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12.5,
    color: theme.colors.primaryDark,
  },
  featureButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  featureButton: {
    flex: 1,
  },
  tripDayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8E8C6",
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tripDayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.warning,
  },
  tripDayPillText: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#8A5B00",
  },
  noTripCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    padding: 16,
    marginBottom: 20,
    backgroundColor: theme.colors.accentLight,
    borderColor: "rgba(45,123,169,0.34)",
  },
  noTripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  noTripCopy: {
    flex: 1,
  },
  noTripTitle: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: 16,
    color: theme.colors.text,
  },
  noTripDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 9,
    paddingVertical: 2,
  },
  inlineLinkText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12.5,
    color: theme.colors.primaryDark,
  },
  launchCard: {
    padding: 18,
    marginBottom: 20,
  },
  launchHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  launchMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryDark,
  },
  launchStar: {
    fontFamily: theme.fonts.serif,
    fontSize: 25,
    color: "#FCF7EA",
  },
  launchHeadingCopy: {
    flex: 1,
  },
  launchTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 20,
    lineHeight: 25,
    color: theme.colors.text,
    marginTop: 2,
  },
  launchDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  launchProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: 16,
  },
  launchProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  launchSteps: {
    marginVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  launchStep: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  launchStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  launchStepCopy: {
    flex: 1,
  },
  launchStepLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.text,
  },
  launchStepDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  launchReadyNote: {
    fontFamily: theme.fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  section: {
    marginTop: 2,
  },
  sectionHeading: {
    marginTop: 20,
    marginBottom: 11,
  },
  sectionEyebrow: {
    ...theme.typography.eyebrow,
    color: theme.colors.primaryDark,
  },
  sectionTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.25,
    color: theme.colors.text,
    marginTop: 2,
  },
  sectionDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  actionListCard: {
    overflow: "hidden",
  },
  actionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: {
    flex: 1,
  },
  actionLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.text,
  },
  actionDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  caughtUpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    marginTop: 20,
    backgroundColor: "#EAF4ED",
  },
  caughtUpIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  caughtUpCopy: {
    flex: 1,
  },
  caughtUpTitle: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.text,
  },
  caughtUpDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48.4%",
    minHeight: 150,
    padding: 14,
  },
  metricIcon: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    marginTop: 11,
  },
  metricValue: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.5,
    color: theme.colors.text,
    marginTop: 3,
  },
  metricValueCompact: {
    fontSize: 20,
    lineHeight: 27,
  },
  metricDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  momentumCard: {
    padding: 0,
    overflow: "hidden",
  },
  momentumStats: {
    flexDirection: "row",
    padding: 17,
  },
  momentumStat: {
    flex: 1,
  },
  momentumLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  momentumLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
  },
  momentumValue: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 24,
    color: theme.colors.text,
    marginTop: 7,
  },
  momentumDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: theme.colors.divider,
    marginHorizontal: 17,
  },
  profileProgressBlock: {
    padding: 17,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    backgroundColor: "rgba(235,224,197,0.36)",
  },
  profileProgressHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  progressLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13.5,
    color: theme.colors.text,
  },
  progressDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  progressValue: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 17,
    color: theme.colors.primaryDark,
  },
  profileProgressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: 12,
  },
  profileProgressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  earningsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2F1E7",
  },
  earningsCopy: {
    flex: 1,
  },
  earningsLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    color: theme.colors.textSecondary,
  },
  earningsValue: {
    fontFamily: theme.fonts.monoMed,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 2,
  },
  earningsLink: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11.5,
    color: theme.colors.primaryDark,
  },
  quickActions: {
    flexDirection: "row",
    // Four tiles in one row would squeeze each label to ~50pt of content
    // width, so they wrap into a 2x2 grid instead.
    flexWrap: "wrap",
    gap: 9,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 124,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(14,25,41,0.11)",
    backgroundColor: theme.colors.surface,
    padding: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...theme.shadows.sm,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.text,
    marginTop: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  errorContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  errorCard: {
    alignItems: "center",
    padding: 24,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(192,57,43,0.10)",
  },
  errorTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 20,
    color: theme.colors.text,
    textAlign: "center",
    marginTop: 14,
  },
  errorMessage: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
});
