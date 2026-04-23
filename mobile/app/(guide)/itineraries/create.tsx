import { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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

interface Stop {
  location: string;
  description: string;
  estimated_duration_minutes: number;
}

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
  const [stops, setStops] = useState<Stop[]>([{ location: '', description: '', estimated_duration_minutes: 30 }]);

  const previewPhoto = coverImageUrl ?? getItineraryPhoto({
    id: 'preview',
    name,
    city,
    category,
  });

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
      const path = `${user.id}/${Date.now()}.${ext}`;

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

  function addStop() {
    setStops([...stops, { location: '', description: '', estimated_duration_minutes: 30 }]);
  }

  function updateStop(idx: number, field: keyof Stop, value: string | number) {
    const updated = [...stops];
    (updated[idx] as Record<keyof Stop, string | number>)[field] = value;
    setStops(updated);
  }

  function removeStop(idx: number) {
    if (stops.length <= 1) return;
    setStops(stops.filter((_, i) => i !== idx));
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
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>+ Add Stop</Text>
            </TouchableOpacity>
          </View>

          {stops.map((stop, idx) => (
            <View
              key={idx}
              style={{
                marginBottom: idx < stops.length - 1 ? 16 : 0,
                paddingBottom: idx < stops.length - 1 ? 16 : 0,
                borderBottomWidth: idx < stops.length - 1 ? 1 : 0,
                borderBottomColor: theme.colors.divider,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20 }}>
        <Button title="Create Tour" onPress={handleSave} loading={saving} size="lg" />
      </View>
    </View>
  );
}
