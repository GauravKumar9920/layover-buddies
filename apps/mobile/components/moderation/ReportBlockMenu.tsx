// ============================================================================
// REPORT / BLOCK MENU — user-safety actions from a conversation
// ============================================================================
// A small modal opened from the chat header's overflow button. Lets a user
// report the other party (with a reason) or block them. Blocking is enforced
// server-side (a blocked pair can't message) — see lib/api/moderation.ts.
// ============================================================================

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { reportUser, blockUser, REPORT_REASONS, type ReportReason } from '@/lib/api/moderation';
import { confirmAsync, notify } from '@/lib/ui/alert';
import { theme } from '@/config/theme';

export function ReportBlockMenu({
  visible,
  onClose,
  targetUserId,
  targetName,
  bookingId,
  onBlocked,
}: {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetName: string;
  bookingId?: string | null;
  onBlocked?: () => void;
}) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setMode('menu');
    onClose();
  }

  function closeAfterSuccess() {
    // Success handlers run while `busy` is still true, so the guarded `close`
    // function intentionally refuses them. Clear busy and close explicitly.
    setBusy(false);
    setMode('menu');
    onClose();
  }

  async function submitReport(reason: ReportReason) {
    setBusy(true);
    try {
      await reportUser({ reportedUserId: targetUserId, bookingId, reason });
      notify('Report submitted', `Thanks — our team will review your report about ${targetName}. In an emergency, call 112.`);
      closeAfterSuccess();
    } catch (err) {
      notify('Could not submit report', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock() {
    const ok = await confirmAsync(
      `Block ${targetName}?`,
      `They won’t be able to message you, and you won’t be able to message them. Contact support if you need to reverse this later.`,
      { confirmLabel: 'Block', destructive: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await blockUser(targetUserId);
      notify('Blocked', `${targetName} has been blocked.`);
      closeAfterSuccess();
      onBlocked?.();
    } catch (err) {
      notify('Could not block', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{ flex: 1, backgroundColor: 'rgba(14,25,41,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          // No-op handler absorbs taps on the sheet so they don't reach the
          // backdrop's onPress (which closes the modal). More reliable across
          // native + web than relying on event.stopPropagation().
          onPress={() => {}}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 10, paddingBottom: 34, paddingHorizontal: 8,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(14,25,41,0.15)' }} />
          </View>

          {mode === 'menu' ? (
            <>
              <MenuTitle>{targetName}</MenuTitle>
              <MenuRow icon="flag" label="Report user" onPress={() => setMode('report')} />
              <MenuRow icon="slash" label="Block user" tone="danger" onPress={handleBlock} disabled={busy} />
              <MenuRow icon="x" label="Cancel" muted onPress={close} />
            </>
          ) : (
            <>
              <MenuTitle>Why are you reporting {targetName}?</MenuTitle>
              {busy ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : (
                <>
                  {REPORT_REASONS.map((r) => (
                    <MenuRow key={r.key} icon="chevron-right" label={r.label} onPress={() => submitReport(r.key)} />
                  ))}
                  <MenuRow icon="arrow-left" label="Back" muted onPress={() => setMode('menu')} />
                </>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
        color: theme.colors.textMuted, paddingHorizontal: 14, paddingVertical: 10,
      }}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  tone,
  muted,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  tone?: 'danger';
  muted?: boolean;
  disabled?: boolean;
}) {
  const color = tone === 'danger' ? theme.colors.error : muted ? theme.colors.textMuted : theme.colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 15, opacity: disabled ? 0.5 : 1 }}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 15.5, color }}>{label}</Text>
    </TouchableOpacity>
  );
}
