import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { Image } from "expo-image";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import {
  Badge,
  bookingStatusLabel,
  bookingStatusVariant,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { TripTimeline } from "@/components/bookings/TripTimeline";
import { TravelerBuddyBrief } from "@/components/bookings/TravelerBuddyBrief";
import { GENDER_OPTIONS } from "@/config/profileOptions";
import { fetchGuideBookingById } from "@/lib/api/bookings";
import { expectedNetPaise } from "@/lib/api/earnings";
import { formatPaise, rupeesToPaise } from "@/lib/booking/money";
import { theme } from "@/config/theme";
import type { BookingState } from "@/lib/booking/stateMachine";
import type { Booking } from "@/types";

export default function GuideBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const fetched = await fetchGuideBookingById(id);
      setBooking(fetched);
    } catch (err: unknown) {
      Alert.alert(
        "Unable to load booking",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return <Loading fullScreen />;

  if (!booking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        }}
      >
        <Header title="Booking" showBack />
        <Card style={{ margin: 16 }}>
          <Text style={{ color: theme.colors.textSecondary }}>
            Booking not found.
          </Text>
        </Card>
      </View>
    );
  }

  const itinerary = booking.itinerary;
  const traveler = booking.traveler;
  const expectedPayoutPaise = expectedNetPaise(booking);
  const showTripDaySafety =
    booking.status === "trip_ready" || booking.status === "in_progress";
  const safety = booking.traveler_safety;
  const genderLabel = safety?.gender
    ? GENDER_OPTIONS.find((option) => option.key === safety.gender)?.label
    : null;
  const hasEmergencyContact = Boolean(
    safety?.emergency_contact_name || safety?.emergency_contact_phone,
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <Header title="Booking Details" showBack />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Traveler */}
        <Card style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
              {traveler?.avatar_url ? (
                <Image
                  source={{ uri: traveler.avatar_url }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.colors.primaryLight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.display,
                      fontSize: 22,
                      color: theme.colors.primary,
                    }}
                  >
                    {(traveler?.name ?? "T")
                      .split(" ")
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.displaySemi,
                    fontSize: 17,
                    color: theme.colors.text,
                  }}
                >
                  {traveler?.name ?? "Traveler"}
                </Text>
                {traveler?.nationality && (
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                      letterSpacing: 0.3,
                      textTransform: "uppercase",
                      marginTop: 4,
                    }}
                  >
                    {traveler.nationality}
                  </Text>
                )}
                {traveler?.phone && (
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 11,
                      color: theme.colors.textSecondary,
                      letterSpacing: 0.3,
                      marginTop: 3,
                    }}
                  >
                    {traveler.phone}
                  </Text>
                )}
              </View>
            </View>
            <Badge
              label={bookingStatusLabel(booking.status)}
              variant={bookingStatusVariant(booking.status)}
            />
          </View>
        </Card>

        <TravelerBuddyBrief traveler={traveler} style={{ marginBottom: 16 }} />

        {showTripDaySafety ? (
          <Card
            style={{
              marginBottom: 16,
              borderColor: "rgba(200,84,42,0.28)",
              gap: 10,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 11,
                  color: theme.colors.primaryDark,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                Trip-day safety
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 12,
                  color: theme.colors.textMuted,
                  lineHeight: 17,
                  marginTop: 4,
                }}
              >
                Private details are available only while this trip is ready or
                in progress.
              </Text>
            </View>

            {genderLabel ? (
              <View>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9.5,
                    color: theme.colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Gender
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.bodySemi,
                    fontSize: 14,
                    color: theme.colors.text,
                    marginTop: 2,
                  }}
                >
                  {genderLabel}
                </Text>
              </View>
            ) : null}

            {hasEmergencyContact ? (
              <View>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9.5,
                    color: theme.colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Emergency contact
                </Text>
                {safety?.emergency_contact_name ? (
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodySemi,
                      fontSize: 14,
                      color: theme.colors.text,
                      marginTop: 2,
                    }}
                  >
                    {safety.emergency_contact_name}
                  </Text>
                ) : null}
                {safety?.emergency_contact_phone ? (
                  <Text
                    style={{
                      fontFamily: theme.fonts.monoMed,
                      fontSize: 14,
                      color: theme.colors.primaryDark,
                      marginTop: 2,
                    }}
                  >
                    {safety.emergency_contact_phone}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!genderLabel && !hasEmergencyContact ? (
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 13,
                  color: theme.colors.textSecondary,
                  lineHeight: 19,
                }}
              >
                No private safety details are available for this trip.
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* Journey timeline — mirrors the traveler's view with buddy CTAs */}
        <TripTimeline
          bookingId={booking.id}
          status={booking.status as BookingState}
          viewer="buddy"
        />

        {/* Flight & schedule */}
        <Card style={{ marginBottom: 16, gap: 6 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 11,
              color: theme.colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            Schedule
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.monoMed,
              fontSize: 14,
              color: theme.colors.text,
            }}
          >
            {format(new Date(booking.start_date), "EEE, MMM d, yyyy · h:mm a")}
          </Text>
          {booking.flight_number && (
            <Text
              style={{
                fontFamily: theme.fonts.monoMed,
                fontSize: 14,
                color: theme.colors.text,
              }}
            >
              Flight {booking.flight_number}
            </Text>
          )}
        </Card>

        {/* Tour */}
        {itinerary && (
          <Card style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 11,
                color: theme.colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 8,
              }}
            >
              Tour
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.displaySemi,
                fontSize: 17,
                color: theme.colors.text,
              }}
            >
              {itinerary.name}
            </Text>
            {itinerary.description ? (
              <Text
                style={{
                  fontSize: 13,
                  color: theme.colors.textSecondary,
                  marginTop: 4,
                  lineHeight: 19,
                }}
              >
                {itinerary.description}
              </Text>
            ) : null}
            {itinerary.stops && itinerary.stops.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {itinerary.stops
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((stop, i) => (
                    <View
                      key={stop.id}
                      style={{ flexDirection: "row", gap: 10 }}
                    >
                      <Text
                        style={{
                          fontFamily: theme.fonts.monoMed,
                          fontSize: 13,
                          color: theme.colors.primary,
                          minWidth: 18,
                        }}
                      >
                        {i + 1}.
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: theme.fonts.bodySemi,
                            fontSize: 14,
                            color: theme.colors.text,
                          }}
                        >
                          {stop.location}
                        </Text>
                        {stop.description ? (
                          <Text
                            style={{
                              fontSize: 12,
                              color: theme.colors.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {stop.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </Card>
        )}

        {/* Payout */}
        <Card style={{ marginBottom: 16, gap: 4 }}>
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 11,
              color: theme.colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginBottom: 4,
            }}
          >
            Payout
          </Text>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}
            >
              Buddy fee
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 14,
                color: theme.colors.text,
              }}
            >
              {formatPaise(rupeesToPaise(booking.buddy_cost))}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 12,
              lineHeight: 17,
              color: theme.colors.textMuted,
              marginTop: 4,
              marginBottom: 6,
            }}
          >
            The traveler&apos;s expense pot is held separately and is not part
            of your earnings.
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: 6,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 15,
                color: theme.colors.primary,
              }}
            >
              Expected net payout
            </Text>
            <Text
              style={{
                ...theme.typography.price,
                fontSize: 22,
                color: theme.colors.primary,
              }}
            >
              {formatPaise(expectedPayoutPaise)}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 11,
              lineHeight: 16,
              color: theme.colors.textMuted,
              marginTop: 5,
            }}
          >
            {booking.commission <= 0
              ? "Early access: no platform fee or TDS."
              : "After the platform fee and TDS. Final payout is confirmed during reconciliation."}
          </Text>
        </Card>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 16,
          left: 16,
          right: 16,
        }}
      >
        <Button
          title="Message traveler"
          onPress={() =>
            router.push(`/(shared)/messages/${booking.id}` as never)
          }
          size="lg"
        />
      </View>
    </View>
  );
}
