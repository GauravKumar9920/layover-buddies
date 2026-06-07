import { View, ActivityIndicator, Text } from 'react-native';
import { theme } from '@/config/theme';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: fullScreen ? theme.colors.background : undefined,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message && (
        <Text
          style={{
            marginTop: 14,
            fontFamily: theme.fonts.mono,
            color: theme.colors.textSecondary,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

/** Skeleton placeholder for a single line of text */
export function SkeletonLine({
  width = '80%',
  height = 14,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: '#E6DBC2',
          borderRadius: 6,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}

/** Skeleton for a guide card */
export function GuideCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        marginBottom: 16,
        ...theme.shadows.md,
      }}
    >
      {/* Hero image placeholder */}
      <View style={{ height: 160, backgroundColor: '#E6DBC2' }} />

      {/* Avatar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#E6DBC2',
            marginTop: -20,
            borderWidth: 3,
            borderColor: theme.colors.surface,
          }}
        />
      </View>

      {/* Text lines */}
      <View style={{ padding: 16, gap: 8 }}>
        <SkeletonLine width="55%" height={18} />
        <SkeletonLine width="40%" height={14} />
        <SkeletonLine width="70%" height={14} />
      </View>
    </View>
  );
}
