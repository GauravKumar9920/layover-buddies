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
  Image,
} from 'react-native';
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
import { theme } from '@/config/theme';
import { format, isSameDay } from 'date-fns';
import type { Message, Booking } from '@/types';

type RenderItem =
  | { kind: 'message'; message: Message; isMine: boolean; showAvatar: boolean; showTime: boolean }
  | { kind: 'day'; key: string; date: Date };

// ─── Header — avatar + name + status, Instagram-style ────────────────────────
function ConversationHeader({
  name,
  avatarUrl,
  insetsTop,
  onBack,
}: {
  name: string;
  avatarUrl: string | null;
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
          <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>Active now</Text>
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
        insetsTop={insets.top}
        onBack={() => router.back()}
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
