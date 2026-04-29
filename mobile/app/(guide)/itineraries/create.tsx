import { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { pickImage } from '@/lib/imagePicker';
import { uploadImage } from '@/lib/imageUpload';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StopEditor, type EditableStop } from '@/components/guides/StopEditor';
import { createItinerary } from '@/lib/api/itineraries';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { SUPPORTED_CITIES } from '@/config/constants';

// DB enum values for itinerary_category
const ITINERARY_CATEGORIES: { value: string; label: string }[] = [
  { value: 'culture', label: 'Culture' },
  { value: 'food', label: 'Food' },
  { value: 'history', label: 'History' },
  { value: 'photography', label: 'Photography' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'custom', label: 'Custom' },
];

export default function CreateItineraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [category, setCategory] = useState('custom');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [maxTravelers, setMaxTravelers] = useState('1');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [stops, setStops] = useState<EditableStop[]>([{ location: '', description: '', estimated_duration_minutes: 30 }]);

  const previewPhoto = coverImageUrl ?? getItineraryPhoto({
    id: 'preview',
    name,
    city,
    category,
  });

  async function handlePickPhoto() {
    const picked = await pickImage({ aspect: [16, 9], quality: 0.8, allowsEditing: true });
    if (!picked) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const ext = picked.fileName.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { publicUrl } = await uploadImage({
        blob: picked.blob,
        bucket: 'itinerary-photos',
        path,
        contentType: picked.mimeType,
        blobUri: picked.uri,
      });
      setCoverImageUrl(publicUrl);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a tour name.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Price required', 'Please enter a valid price in INR.');
      return;
    }
    if (!duration || isNaN(Number(duration))) {
      Alert.alert('Duration required', 'Please enter the tour duration in hours.');
      return;
    }

    setSaving(true);
    try {
      await createItinerary({
        name: name.trim(),
        description: description.trim(),
        estimated_duration_hours: Number(duration),
        buddy_cost_inr: Number(price),
        max_travelers: Math.max(1, Math.min(12, Number(maxTravelers) || 1)),
        category,
        cover_image_url: coverImageUrl,
        stops: stops
          .filter((s) => s.location.trim())
          .map((s, i) => ({ ...s, order: i + 1 })),
      });
      Alert.alert('✅ Tour Created!', 'Your itinerary is now live and visible to travelers.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create tour');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Create Tour" showBack />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 }}>
            Tour Details
          </Text>

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
                backgroundColor: coverImageUrl ? 'transparent' : 'rgba(249,115,22,0.08)',
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

          <Input label="Tour Name" value={name} onChangeText={setName} placeholder="e.g. Mumbai in 3 Hours" />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what travelers will experience..."
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

          {/* City */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              City
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUPPORTED_CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCity(c)}
                  style={{
                    backgroundColor: city === c ? theme.colors.primary : theme.colors.primaryLight,
                    borderRadius: theme.borderRadius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: city === c ? '#FFFFFF' : theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <Input
              label="Duration (hours)"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="e.g. 3"
              style={{ flex: 1 }}
            />
            <Input
              label="Max Travelers"
              value={maxTravelers}
              onChangeText={setMaxTravelers}
              keyboardType="numeric"
              placeholder="1"
              style={{ flex: 1 }}
            />
          </View>

          <Input
            label="Your Price (₹ INR)"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="e.g. 2000"
            style={{ marginTop: 12 }}
            hint="You'll receive 75% after platform fee"
          />
        </Card>

        {/* Stops */}
        <StopEditor stops={stops} onChange={setStops} />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20 }}>
        <Button title="Create Tour" onPress={handleSave} loading={saving} size="lg" />
      </View>
    </View>
  );
}
