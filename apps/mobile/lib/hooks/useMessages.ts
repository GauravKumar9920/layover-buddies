import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { fetchMessages, sendMessage } from '../api/messages';
import type { Message } from '@/types';

export function useMessages(bookingId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const msgs = await fetchMessages(bookingId);
      setMessages(msgs);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Load initial messages
  useEffect(() => {
    let mounted = true;
    reload();

    // Subscribe to realtime new messages
    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (mounted) {
            setMessages((prev) => {
              // Deduplicate by id
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as Message];
            });
          }
        },
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setError(null);
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('Chat connection interrupted. Pull down to reconnect.');
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [bookingId, reload]);

  const send = useCallback(async (content: string): Promise<boolean> => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    setSending(true);
    try {
      setError(null);
      const created = await sendMessage({ booking_id: bookingId, content: trimmed });
      setMessages((prev) => {
        if (prev.some((message) => message.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      return false;
    } finally {
      setSending(false);
    }
  }, [bookingId]);

  return { messages, loading, sending, error, send, reload };
}
