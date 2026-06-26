import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Badge, bookingStatusLabel, bookingStatusVariant } from '@/components/ui/Badge';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
  showGuide?: boolean;
  showTraveler?: boolean;
  unreadCount?: number;
}

export function BookingCard({ booking, onPress, showGuide = true, showTraveler = false, unreadCount = 0 }: BookingCardProps) {
  const displayName = showGuide
    ? booking.guide?.name ?? 'Guide'
    : booking.traveler?.name ?? 'Traveler';

  const startDate = new Date(booking.start_date);
  const formattedDate = Number.isNaN(startDate.getTime())
    ? 'Date TBD'
    : format(startDate, 'EEE, MMM d, yyyy');

  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 16, color: theme.colors.text }}>
              {booking.itinerary?.name ?? 'Tour'}
            </Text>
            {unreadCount > 0 && (
              <View style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 5,
              }}>
                <Text style={{ fontFamily: theme.fonts.monoMed, color: '#FCF7EA', fontSize: 11 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 }}>
            {showGuide ? 'Guide · ' : 'Traveler · '}{displayName}
          </Text>
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 5 }}>
            {formattedDate}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Badge
            label={bookingStatusLabel(booking.status)}
            variant={bookingStatusVariant(booking.status)}
          />
          <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 16, color: theme.colors.primary }}>
            ₹{booking.total_price.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {booking.itinerary?.city && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(14,25,41,0.08)',
          }}
        >
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {booking.itinerary.city}
            {booking.flight_number && `  ·  ${booking.flight_number}`}
          </Text>
        </View>
      )}
    </Card>
  );
}
