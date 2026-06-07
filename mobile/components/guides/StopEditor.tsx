import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { pickImage } from '@/lib/imagePicker';
import { uploadImage } from '@/lib/imageUpload';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';

export interface EditableStop {
  // Present for stops loaded from the DB; absent for newly added ones.
  id?: string;
  location: string;
  description: string;
  estimated_duration_minutes: number;
  /** Photo for this stop — shows on the traveler "A day with…" timeline. */
  image_url?: string | null;
}

export interface StopEditorProps {
  stops: EditableStop[];
  onChange: (next: EditableStop[]) => void;
}

export function StopEditor({ stops, onChange }: StopEditorProps) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function addStop() {
    onChange([...stops, { location: '', description: '', estimated_duration_minutes: 30 }]);
  }

  async function pickStopPhoto(idx: number) {
    const picked = await pickImage({ aspect: [16, 9], quality: 0.8, allowsEditing: true });
    if (!picked) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setUploadingIdx(idx);
    try {
      const ext = picked.fileName.split('.').pop() ?? 'jpg';
      const path = `stops/${user.id}/${Date.now()}.${ext}`;
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: 'itinerary-photos',
        path,
        contentType: picked.mimeType,
        blobUri: picked.uri,
      });
      updateStop(idx, 'image_url', publicUrl);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploadingIdx(null);
    }
  }

  function updateStop<K extends keyof EditableStop>(idx: number, field: K, value: EditableStop[K]) {
    const next = stops.map((stop, i) => (i === idx ? { ...stop, [field]: value } : stop));
    onChange(next);
  }

  function removeStop(idx: number) {
    if (stops.length <= 1) return;
    onChange(stops.filter((_, i) => i !== idx));
  }

  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
          Itinerary Stops
        </Text>
        <TouchableOpacity
          onPress={addStop}
          style={{
            backgroundColor: theme.colors.primaryLight,
            borderRadius: theme.borderRadius.sm,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
            + Add Stop
          </Text>
        </TouchableOpacity>
      </View>

      {stops.map((stop, idx) => (
        <View
          key={stop.id ?? `new-${idx}`}
          style={{
            marginBottom: idx < stops.length - 1 ? 16 : 0,
            paddingBottom: idx < stops.length - 1 ? 16 : 0,
            borderBottomWidth: idx < stops.length - 1 ? 1 : 0,
            borderBottomColor: theme.colors.divider,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }}>
              Stop {idx + 1}
            </Text>
            {stops.length > 1 && (
              <TouchableOpacity onPress={() => removeStop(idx)}>
                <Text style={{ color: theme.colors.error, fontSize: 13 }}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <Input
            label="Location"
            value={stop.location}
            onChangeText={(v) => updateStop(idx, 'location', v)}
            placeholder="e.g. Gateway of India"
          />
          <Input
            label="Description (optional)"
            value={stop.description}
            onChangeText={(v) => updateStop(idx, 'description', v)}
            placeholder="What will travelers see here?"
            style={{ marginTop: 8 }}
          />
          <Input
            label="Duration (minutes)"
            value={String(stop.estimated_duration_minutes)}
            onChangeText={(v) => updateStop(idx, 'estimated_duration_minutes', Number(v) || 30)}
            keyboardType="numeric"
            style={{ marginTop: 8 }}
          />

          {/* Stop photo — appears on the traveler "A day with…" timeline */}
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Stop photo (optional)
          </Text>
          {stop.image_url ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image
                source={{ uri: stop.image_url }}
                style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: theme.colors.surfaceMuted }}
                contentFit="cover"
                transition={200}
              />
              <TouchableOpacity onPress={() => pickStopPhoto(idx)}>
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bodySemi, fontSize: 13 }}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => updateStop(idx, 'image_url', null)}>
                <Text style={{ color: theme.colors.error, fontFamily: theme.fonts.bodySemi, fontSize: 13 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => pickStopPhoto(idx)}
              disabled={uploadingIdx === idx}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                alignSelf: 'flex-start',
                borderWidth: 1.5, borderColor: theme.colors.primary, borderStyle: 'dashed',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                backgroundColor: theme.colors.primaryLight,
                opacity: uploadingIdx === idx ? 0.6 : 1,
              }}
            >
              <Feather name={uploadingIdx === idx ? 'loader' : 'camera'} size={15} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bodySemi, fontSize: 13 }}>
                {uploadingIdx === idx ? 'Uploading…' : 'Add photo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Card>
  );
}
