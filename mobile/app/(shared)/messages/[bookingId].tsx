import { useState, useRef, useEffect } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Header } from '@/components/ui/Header';
import { Loading } from '@/components/ui/Loading';
import { useMessages } from '@/lib/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import { fetchBookingById } from '@/lib/api/bookings';
import { markMessagesRead } from '@/lib/api/messages';
import { theme } from '@/config/theme';
import { format } from 'date-fns';
import type { Message, Booking } from '@/types';

export default function MessagesScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [inputText, setInputText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { messages, loading, sending, error, send, reload } = useMessages(bookingId ?? '');

  // Send button scale animation
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

  // Scroll to bottom and mark new messages as read
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
    if (sent) {
      setInputText('');
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const otherName = currentUserId === booking?.traveler_id
    ? booking?.guide?.name ?? 'Guide'
    : booking?.traveler?.name ?? 'Traveler';

  if (loading || !currentUserId) return <Loading fullScreen message="Loading messages..." />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: insets.top }}>
        <Header title={otherName} showBack />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            isMine={item.sender_id === currentUserId}
            showTime={
              index === messages.length - 1 ||
              messages[index + 1]?.sender_id !== item.sender_id
            }
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 36 }}>💬</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 12, textAlign: 'center', fontSize: 14 }}>
              No messages yet.{'\n'}Say hello to {otherName}!
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: theme.colors.error, fontSize: 12 }}>
            {error}
          </Text>
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
          placeholder="Message..."
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            color: theme.colors.text,
            maxHeight: 120,
            minHeight: 40,
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
              <Text style={{ color: '#FFFFFF', fontSize: 18 }}>↑</Text>
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
  showTime,
}: {
  message: Message;
  isMine: boolean;
  showTime: boolean;
}) {
  return (
    <View
      style={{
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginBottom: 4,
      }}
    >
      <View
        style={{
          maxWidth: '78%',
          backgroundColor: isMine ? theme.colors.primary : '#FFFFFF',
          borderRadius: 18,
          borderBottomRightRadius: isMine ? 4 : 18,
          borderBottomLeftRadius: isMine ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          ...(isMine ? {} : theme.shadows.sm),
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
            marginHorizontal: 4,
          }}
        >
          {format(new Date(message.created_at), 'h:mm a')}
        </Text>
      )}
    </View>
  );
}
