import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { updateItinerary } from '@/lib/api/itineraries';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { theme } from '@/config/theme';
import type { Itinerary } from '@/types';

const ITINERARY_CATEGORIES: { value: string; label: string }[] = [
  { value: 'culture', label: 'Culture' },
  { value: 'food', label: 'Food' },
  { value: 'history', label: 'History' },
  { value: 'photography', label: 'Photography' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'custom', label: 'Custom' },
];

function normalizeItineraryRow(row: Record<string, unknown>): Itinerary {
  const title = typeof row.title === 'string' && row.title.trim() ? row.title : 'Mumbai Tour';

  return {
    id: String(row.id ?? ''),
    guide_id: String(row.guide_id ?? ''),
    name: title,
    title,
    description: typeof row.description === 'string' ? row.description : '',
    city: 'Mumbai',
    category: typeof row.category === 'string' ? row.category : null,
    image_url: typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    cover_image_url: typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: 1,
    is_active: Boolean(row.is_published ?? false),
    created_at: String(row.created_at ?? new Date().toISOString()),
    stops: [],
  };
}

export default function EditItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itin, setItin] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState('custom');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const previewPhoto = coverImageUrl ?? getItineraryPhoto({
    id: itin?.id ?? 'preview',
    name,
    city: itin?.city ?? 'Mumbai',
    category,
    image_url: coverImageUrl ?? itin?.image_url,
    cover_image_url: coverImageUrl ?? itin?.cover_image_url,
  });

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    async function loadItinerary() {
      try {
        const { data, error } = await supabase
          .from('itineraries')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!isMounted || !data) return;

        const normalized = normalizeItineraryRow(data as Record<string, unknown>);
        setItin(normalized);
        setName(normalized.name);
        setDescription(normalized.description ?? '');
        setPrice(String(normalized.buddy_cost_inr));
        setDuration(String(normalized.estimated_duration_hours));
        setCategory(normalized.category ?? 'custom');
        setCoverImageUrl(normalized.cover_image_url ?? null);
      } catch (err: unknown) {
        Alert.alert('Unable to load tour', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadItinerary();
    return () => { isMounted = false; };
  }, [id]);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${id ?? Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('itinerary-photos')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

      if (uploadErr) {
        Alert.alert('Upload failed', uploadErr.message);
        return;
      }

      const { data: urlData } = supabase.storage.from('itinerary-photos').getPublicUrl(path);
      setCoverImageUrl(urlData.publicUrl);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await updateItinerary(id, {
        name: name.trim(),
        description: description.trim(),
        buddy_cost_inr: Number(price),
        estimated_duration_hours: Number(duration),
        category,
        cover_image_url: coverImageUrl,
      });
      Alert.alert('✅ Updated', 'Tour updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Edit Tour" showBack />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          {/* Cover Photo */}
          <TouchableOpacity onPress={handlePickPhoto} style={{ marginBottom: 14 }}>
            <View style={{ height: 140, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.primaryLight }}>
              {previewPhoto ? (
                <Image
                  source={{ uri: previewPhoto }}
                  contentFit="cover"
                  transition={250}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
              <View style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: coverImageUrl ? 'transparent' : 'rgba(13,115,119,0.08)',
              }}>
                {uploadingPhoto ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <View style={{
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                      {coverImageUrl ? '📷 Change Photo' : '📷 Add Cover Photo'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <Input label="Tour Name" value={name} onChangeText={setName} />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ marginTop: 12 }}
          />

          {/* Category */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ITINERARY_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  style={{
                    backgroundColor: category === cat.value ? theme.colors.primary : theme.colors.primaryLight,
                    borderRadius: theme.borderRadius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: category === cat.value ? '#FFFFFF' : theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <Input
              label="Duration (hours)"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <Input
              label="Price (₹)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20 }}>
        <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
      </View>
    </View>
  );
}
