import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Loading } from '@/components/ui/Loading';
import { useMessages } from '@/lib/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import { fetchBookingById } from '@/lib/api/bookings';
import { markMessagesRead } from '@/lib/api/messages';
import { getBookingCta } from '@/lib/booking/cta';
import { safeBack } from '@/lib/navigation';
import { bookingStatusLabel } from '@/components/ui/Badge';
import { theme } from '@/config/theme';
import { format, isSameDay } from 'date-fns';
import type { Message, Booking } from '@/types';
import type { BookingState } from '@/lib/booking/stateMachine';

type RenderItem =
  | { kind: 'message'; message: Message; isMine: boolean; showAvatar: boolean; showTime: boolean }
  | { kind: 'day'; key: string; date: Date };

// ─── Header — avatar + name + status, Instagram-style ────────────────────────
function ConversationHeader({
  name,
  avatarUrl,
  subtitle,
  insetsTop,
  onBack,
}: {
  name: string;
  avatarUrl: string | null;
  subtitle?: string;
  insetsTop: number;
  onBack: () => void;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        paddingTop: insetsTop,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.divider,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={{ fontSize: 26, color: theme.colors.text, lineHeight: 28 }}>‹</Text>
        </TouchableOpacity>

        <Avatar uri={avatarUrl} initials={initials} size={36} />

        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}
            numberOfLines={1}
          >
            {name}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 12, color: theme.colors.textMuted }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Avatar — circle image with initials fallback ────────────────────────────
function Avatar({
  uri,
  initials,
  size,
}: {
  uri: string | null;
  initials: string;
  size: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.divider,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.4,
          fontWeight: '700',
        }}
      >
        {initials || '?'}
      </Text>
    </View>
  );
}

// ─── Day separator ───────────────────────────────────────────────────────────
function DaySeparator({ date }: { date: Date }) {
  const today = new Date();
  let label: string;
  if (isSameDay(date, today)) label = 'Today';
  else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    label = isSameDay(date, yesterday) ? 'Yesterday' : format(date, 'EEEE, MMM d');
  }
  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <Text
        style={{
          fontSize: 11,
          color: theme.colors.textMuted,
          fontWeight: '600',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [inputText, setInputText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { messages, loading, sending, error, send, reload } = useMessages(bookingId ?? '');

  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
    if (bookingId) {
      fetchBookingById(bookingId).then(setBooking);
      markMessagesRead(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      if (bookingId) markMessagesRead(bookingId);
    }
  }, [messages.length, bookingId]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text) return;

    sendScale.value = withSpring(0.88, { damping: 8, stiffness: 200 }, () => {
      sendScale.value = withSpring(1, { damping: 10 });
    });

    const sent = await send(text);
    if (sent) setInputText('');
  }

  async function handleRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const isTraveler = currentUserId === booking?.traveler_id;
  const otherName = isTraveler
    ? booking?.guide?.name ?? 'Guide'
    : booking?.traveler?.name ?? 'Traveler';
  const otherAvatar = isTraveler
    ? booking?.guide?.avatar_url ?? null
    : booking?.traveler?.avatar_url ?? null;

  // Build a renderable list with day separators interleaved between messages.
  // Memoised so that typing in the input (which triggers re-renders) doesn't
  // rebuild the entire list on every keystroke.
  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];
    let lastDate: Date | null = null;

    messages.forEach((msg, i) => {
      const date = new Date(msg.created_at);
      if (!lastDate || !isSameDay(date, lastDate)) {
        items.push({ kind: 'day', key: 'day-' + msg.id, date });
        lastDate = date;
      }
      const isMine = msg.sender_id === currentUserId;
      const next = messages[i + 1];
      const sameSenderNext = next && next.sender_id === msg.sender_id;
      const sameDayNext = next && isSameDay(new Date(next.created_at), date);
      const isLastInStreak = !next || !sameSenderNext || !sameDayNext;
      items.push({
        kind: 'message',
        message: msg,
        isMine,
        showAvatar: !isMine && isLastInStreak,
        showTime: isLastInStreak,
      });
    });

    return items;
  }, [messages, currentUserId]);

  if (loading || !currentUserId) return <Loading fullScreen message="Loading messages..." />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ConversationHeader
        name={otherName}
        avatarUrl={otherAvatar}
        // Subtitle reflects real booking status (e.g. "Chat Open",
        // "Awaiting Deposit") instead of the previous hardcoded "Active now"
        // lie. Falls back gracefully when booking is still loading.
        subtitle={booking ? bookingStatusLabel(booking.status) : undefined}
        insetsTop={insets.top}
        // When this screen was reached via router.replace (e.g. the chat-intent
        // flow from a guide profile) the history stack is empty and a plain
        // router.back() does nothing.  safeBack falls through to the inbox of
        // whichever role the current user is, so the arrow is always live.
        onBack={() =>
          // Traveler tabs were grouped under (tabs)/ in the restructure; guide
          // still flat. Route to the inbox of whichever role the user is.
          safeBack(router, isTraveler ? '/(traveler)/(tabs)/messages' : '/(guide)/messages')
        }
      />

      <FlatList
        ref={flatListRef}
        data={renderItems}
        keyExtractor={(item) => (item.kind === 'day' ? item.key : item.message.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return <DaySeparator date={item.date} />;
          }
          return (
            <MessageBubble
              message={item.message}
              isMine={item.isMine}
              showAvatar={item.showAvatar}
              showTime={item.showTime}
              avatarUrl={otherAvatar}
              otherName={otherName}
            />
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 36 }}>💬</Text>
            <Text
              style={{
                color: theme.colors.textSecondary,
                marginTop: 12,
                textAlign: 'center',
                fontSize: 14,
              }}
            >
              No messages yet.{'\n'}Say hello to {otherName}!
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text>
        </View>
      )}

      {/* Phase 2 — Agreement chip (above input bar) */}
      {booking && <AgreementChip booking={booking} isTraveler={isTraveler} />}

      {/* Quick-action chips — only for travelers in early states. Helps users
          who aren't sure how to start the conversation. Tapping a chip
          stages the suggested text in the input so they can tweak before
          sending — never auto-sends. */}
      {booking && isTraveler && !inputText && (
        <QuickChips
          status={booking.status}
          onPick={(text) => setInputText(text)}
        />
      )}

      {/* Input Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 12,
          paddingVertical: 10,
          paddingBottom: insets.bottom + 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          gap: 10,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${otherName.split(' ')[0]}…`}
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            color: theme.colors.text,
            maxHeight: 120,
            minHeight: 40,
            borderWidth: 1,
            borderColor: theme.colors.divider,
          }}
          placeholderTextColor={theme.colors.textMuted}
        />
        <Animated.View style={sendStyle}>
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !inputText.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.divider,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>↑</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  isMine,
  showAvatar,
  showTime,
  avatarUrl,
  otherName,
}: {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  showTime: boolean;
  avatarUrl: string | null;
  otherName: string;
}) {
  const initials = otherName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        marginBottom: 2,
        gap: 6,
      }}
    >
      {/* Avatar slot for incoming messages — keeps bubbles aligned even when avatar is hidden */}
      {!isMine && (
        <View style={{ width: 28 }}>
          {showAvatar && <Avatar uri={avatarUrl} initials={initials} size={28} />}
        </View>
      )}

      <View style={{ maxWidth: '72%', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        <View
          style={{
            backgroundColor: isMine ? theme.colors.primary : '#FFFFFF',
            borderRadius: 22,
            // Tighter corner only on the side closest to its sender (Instagram pattern)
            borderBottomRightRadius: isMine ? 6 : 22,
            borderBottomLeftRadius: isMine ? 22 : 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: isMine ? 0 : 1,
            borderColor: theme.colors.divider,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              color: isMine ? '#FFFFFF' : theme.colors.text,
              lineHeight: 21,
            }}
          >
            {message.content}
          </Text>
        </View>
        {showTime && (
          <Text
            style={{
              fontSize: 11,
              color: theme.colors.textMuted,
              marginTop: 4,
              marginHorizontal: 6,
            }}
          >
            {format(new Date(message.created_at), 'h:mm a')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Phase 2 — agreement chip above the composer ─────────────────────────────
// Surfaces a one-tap entry into the agreement screen. Derives its label and
// route from `getBookingCta` (cta.ts) — the single source of truth for
// status × viewer → action — so future state-machine changes only need one
// edit. Hidden when there's no navigable agreement action (cta.route === null).
function AgreementChip({ booking, isTraveler }: { booking: Booking; isTraveler: boolean }) {
  const router  = useRouter();
  const viewer  = isTraveler ? 'traveler' : 'buddy';
  const cta     = getBookingCta(booking.status as BookingState, viewer);

  // Only show when there is an agreement screen to navigate to.
  if (!cta.label || !cta.route) return null;

  const route = cta.route.pathname.replace('[bookingId]', booking.id);

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
      <TouchableOpacity
        onPress={() => router.push(route as never)}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: theme.colors.primaryLight,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }}
      >
        <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
          📋 {cta.label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quick-action chips ──────────────────────────────────────────────────────
// Travelers often need a nudge to start the conversation — and once they're
// chatting, "add this to my itinerary" is the most common ask. This row of
// chips lives above the input bar (only when the traveler hasn't typed
// anything yet) and stages text in the input so they can edit before sending.
function QuickChips({
  status,
  onPick,
}: {
  status: string;
  onPick: (text: string) => void;
}) {
  // Choose chips based on lifecycle. Early states emphasize discovery /
  // personalization; later states pivot toward logistics.
  const EARLY = ['chat_open', 'agreement_drafting', 'agreement_sent'];
  const inEarly = EARLY.includes(status);

  const chips = inEarly
    ? [
        { emoji: '👋', label: 'Inquire about a tour', text: "Hi! Could you tell me a bit more about your walks?" },
        { emoji: '🎯', label: 'Help personalize',     text: "I'd love help personalizing this trip for me — got time to chat?" },
        { emoji: '🍜', label: 'Add food spot',         text: "Could we add a great street-food stop to the itinerary?" },
        { emoji: '🍹', label: 'Add drinks',            text: "Could we work in a drinks spot somewhere on the route?" },
        { emoji: '🚕', label: 'Transport help',        text: "What's the best way to get between stops — taxi, train, or walking?" },
      ]
    : [
        { emoji: '🍜', label: 'Add food spot',  text: "Could we add a food stop to the itinerary?" },
        { emoji: '📍', label: 'Meeting point',  text: "Where exactly should we meet?" },
        { emoji: '⏰', label: 'Timing check',   text: "Quick check on timing — does the schedule still work?" },
      ];

  return (
    <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
      <FlatList
        horizontal
        data={chips}
        keyExtractor={(c) => c.label}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPick(item.text)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              borderRadius: 999,
              paddingHorizontal: 12, paddingVertical: 7,
              backgroundColor: '#FFFFFF',
              borderWidth: 1, borderColor: theme.colors.divider,
            }}
          >
            <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
