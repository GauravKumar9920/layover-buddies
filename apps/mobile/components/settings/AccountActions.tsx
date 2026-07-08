// ============================================================================
// ACCOUNT ACTIONS — legal links + account deletion
// ============================================================================
// Shared by the traveler and guide profile screens. Surfaces the tappable
// Terms/Privacy/Support links both stores require, and the in-app account
// deletion Apple mandates (Guideline 5.1.1(v)).
//
// Deletion anonymizes personal data server-side and revokes the login (see the
// delete-account Edge fn). Afterwards the auth user no longer exists, so we
// clear the LOCAL session (a server sign-out would 401) and let the root
// navigator route back to the auth stack.
// ============================================================================

import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { confirmAsync, notify } from '@/lib/ui/alert';
import { deleteAccount } from '@/lib/api/account';
import { supabase } from '@/lib/supabase';
import { LEGAL, SUPPORT_EMAIL } from '@/config/constants';
import { theme } from '@/config/theme';

function Row({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 }}
    >
      <Feather name={icon} size={17} color={theme.colors.textSecondary} />
      <Text style={{ flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: 14.5, color: theme.colors.text }}>{label}</Text>
      <Feather name="external-link" size={15} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

export function AccountActions() {
  const [deleting, setDeleting] = useState(false);

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => notify('Could not open link', url));
  }

  async function handleDelete() {
    const ok = await confirmAsync(
      'Delete your account?',
      'This permanently deletes your Detour account and removes your personal information. Completed trips are kept in anonymized form for legal and tax records. This cannot be undone.',
      { confirmLabel: 'Delete account', destructive: true },
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteAccount();
      // The auth user is gone — clear the LOCAL session only (a server-side
      // sign-out would fail against a deleted user). Root nav then routes to
      // the auth stack.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => { /* best-effort */ });
      notify('Account deleted', 'Your account and personal data have been removed.');
    } catch (err) {
      notify('Could not delete account', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const divider = <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.08)' }} />;

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{
        fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
        color: theme.colors.textSecondary, marginBottom: 8, marginLeft: 4,
      }}>
        Legal & support
      </Text>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Row icon="file-text" label="Terms of Service" onPress={() => openUrl(LEGAL.termsUrl)} />
        {divider}
        <Row icon="shield" label="Privacy Policy" onPress={() => openUrl(LEGAL.privacyUrl)} />
        {divider}
        <Row icon="mail" label="Contact support" onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`)} />
      </Card>

      <Button
        title="Delete account"
        onPress={handleDelete}
        variant="ghost"
        loading={deleting}
        style={{ marginTop: 16 }}
        textStyle={{ color: theme.colors.error }}
      />
      <Text style={{
        fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.textMuted,
        textAlign: 'center', marginTop: 8, lineHeight: 16, paddingHorizontal: 12,
      }}>
        Permanently deletes your account and personal data. Completed-trip records are kept anonymized for legal and tax purposes.
      </Text>
    </View>
  );
}
