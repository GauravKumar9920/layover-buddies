import { View, Text, ViewStyle } from 'react-native';
import { Button } from './Button';
import { theme } from '@/config/theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: 1,
          borderColor: 'rgba(14,25,41,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.serif, fontSize: 30, color: theme.colors.textMuted }}>✦</Text>
      </View>
      <Text
        style={{
          ...theme.typography.h3,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} size="sm" />
      )}
    </View>
  );
}
