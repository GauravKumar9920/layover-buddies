import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { theme } from '@/config/theme';

export interface EditableStop {
  // Present for stops loaded from the DB; absent for newly added ones.
  id?: string;
  location: string;
  description: string;
  estimated_duration_minutes: number;
}

export interface StopEditorProps {
  stops: EditableStop[];
  onChange: (next: EditableStop[]) => void;
}

export function StopEditor({ stops, onChange }: StopEditorProps) {
  function addStop() {
    onChange([...stops, { location: '', description: '', estimated_duration_minutes: 30 }]);
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
        </View>
      ))}
    </Card>
  );
}
