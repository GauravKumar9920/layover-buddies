// ============================================================================
// BUDDY QR SCAN — Guide (Phase 4)
// ============================================================================
// Buddy opens this screen when status = trip_ready. Points camera at the
// traveler's QR code, calls `qr-scan` Edge fn on decode.
//
// Handles:
//   - Camera permission flow
//   - VPA missing → routes to payout-vpa screen
//   - Scan error / wrong token
//   - Success → replace to in-trip screen
//
// Route: /(guide)/bookings/qr-scan/[bookingId]
// ============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { scanQrToken } from '@/lib/api/tripLifecycle';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import { notify, confirmAsync } from '@/lib/ui/alert';

// expo-camera ~16 (Expo SDK 52) — CameraView + useCameraPermissions
let CameraView: React.ComponentType<{
  style: object;
  facing?: 'back' | 'front';
  barcodeScannerSettings?: { barcodeTypes: string[] };
  onBarcodeScanned?: (e: { data: string }) => void;
}> | null = null;

// Module-level stable hook reference — satisfies Rules of Hooks (the hook must
// be called unconditionally in the component body; the conditional logic lives
// here, at module scope, not inside the render function).
type PermissionHookReturn = [{ granted: boolean } | null, () => Promise<{ granted: boolean }>];
const _nullHook = (): PermissionHookReturn => [null, async () => ({ granted: false })];
let _useCameraHook: () => PermissionHookReturn = _nullHook;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require('expo-camera');
  CameraView = cam.CameraView ?? null;
  if (typeof cam.useCameraPermissions === 'function') {
    _useCameraHook = cam.useCameraPermissions;
  }
} catch {
  CameraView = null;
}

export default function GuideQrScanScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const copy    = financialCopy.tripQrInstructions;

  // Always call the stable module-level hook reference — satisfies Rules of Hooks.
  const [permission, requestPermission] = _useCameraHook();

  const [scanning,    setScanning]    = useState(false);
  const [scanned,     setScanned]     = useState(false);

  // ── QR decode handler ──────────────────────────────────────────────────────
  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || scanning || !bookingId) return;
    setScanned(true);
    setScanning(true);

    try {
      const result = await scanQrToken({ bookingId, token: data });

      if (result.error === 'vpa_missing') {
        const goSetup = await confirmAsync(
          copy.vpaMissing.heading,
          copy.vpaMissing.body,
          { confirmLabel: copy.vpaMissing.cta },
        );
        if (goSetup) {
          router.replace({
            pathname: '/(guide)/profile/payout-vpa',
            params:   { returnBookingId: bookingId },
          } as never);
        } else {
          setScanned(false);
        }
        return;
      }

      if (!result.ok) {
        notify('Scan failed', copy.scanError);
        setScanned(false);
        return;
      }

      // Trip is now in_progress — navigate to in-trip screen.
      router.replace({
        pathname: '/(guide)/bookings/in-trip/[bookingId]',
        params:   { bookingId },
      } as never);
    } catch (err) {
      notify('Error', err instanceof Error ? err.message : 'Scan failed. Try again.');
      setScanned(false);
    } finally {
      setScanning(false);
    }
  }

  // ── Camera not available ───────────────────────────────────────────────────
  if (!CameraView || _useCameraHook === _nullHook) {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <Header title="Scan QR" />
        <View style={styles.permissionBody}>
          <Text style={styles.permissionHeading}>Camera not available</Text>
          <Text style={styles.permissionSub}>
            Install expo-camera to enable QR scanning.
          </Text>
        </View>
      </View>
    );
  }

  // ── Permission pending ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <Header title="Scan QR" />
        <View style={styles.permissionBody}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={styles.permissionHeading}>Camera access needed</Text>
          <Text style={styles.permissionSub}>
            Allow camera access to scan the traveler's QR code and start the trip.
          </Text>
          <Button title="Allow camera" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  // ── Camera active ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Scan QR" />
      <Text style={styles.instructionText}>{copy.buddySub}</Text>

      <View style={styles.scannerWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Dark overlay with viewfinder cut-out */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Top dark band */}
          <View style={[styles.overlayBand, { flex: 1 }]} />
          {/* Middle row: side bands + viewfinder */}
          <View style={styles.overlayMiddle}>
            <View style={[styles.overlayBand, { width: 40 }]} />
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={[styles.overlayBand, { width: 40 }]} />
          </View>
          {/* Bottom dark band */}
          <View style={[styles.overlayBand, { flex: 1 }]} />
        </View>

        {/* Processing overlay */}
        {scanning && (
          <View style={styles.processingBadge}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.processingText}>Starting trip…</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        Align the QR code inside the frame
      </Text>
    </View>
  );
}

const VF_SIZE = 240;
const CORNER  = 24;
const BORDER  = 3;

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#000000' },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  permissionBody:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: theme.colors.background },
  permissionEmoji:   { fontSize: 52, marginBottom: 16 },
  permissionHeading: { fontSize: 20, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  permissionSub:     { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  instructionText:   { fontSize: 14, color: '#E2E8F0', textAlign: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  scannerWrapper:    { flex: 1, position: 'relative' },
  overlayBand:       { backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle:     { flexDirection: 'row', height: VF_SIZE },
  viewfinder:        { width: VF_SIZE, height: VF_SIZE, position: 'relative' },
  corner:            { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#F97316', borderWidth: BORDER },
  cornerTL:          { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR:          { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL:          { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR:          { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  processingBadge:   {
    position:        'absolute',
    bottom:          24,
    alignSelf:       'center',
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:    24,
  },
  processingText:    { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  hint:              { color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});
