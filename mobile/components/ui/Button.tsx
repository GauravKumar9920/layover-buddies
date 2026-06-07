import { useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@/config/theme';
import { hapticImpactMedium } from '@/lib/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, { paddingH: number; paddingV: number; fontSize: number; borderRadius: number }> = {
  sm: { paddingH: 16, paddingV: 9,  fontSize: 13, borderRadius: 10 },
  md: { paddingH: 20, paddingV: 14, fontSize: 15, borderRadius: 12 },
  lg: { paddingH: 24, paddingV: 17, fontSize: 16, borderRadius: 12 },
};

// Warm Editorial buttons: solid fills with a hairline ink/terracotta border —
// the "outlined ticket" look from the marketing site — not neon gradients.
const VARIANT: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
  primary:   { bg: theme.colors.primary,   border: theme.colors.primaryDark, text: '#FCF7EA' },
  secondary: { bg: theme.colors.surface,   border: theme.colors.text,        text: theme.colors.text },
  danger:    { bg: theme.colors.error,     border: '#8E2C20',                text: '#FCF7EA' },
  ghost:     { bg: 'transparent',          border: 'transparent',            text: theme.colors.primary },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { paddingH, paddingV, fontSize, borderRadius } = SIZE_STYLES[size];
  const isDisabled = disabled || loading;
  const v = VARIANT[variant];

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
    hapticImpactMedium();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, [scale]);

  const content = loading ? (
    <ActivityIndicator size="small" color={isDisabled ? '#9A9384' : v.text} />
  ) : (
    <>
      {icon && <View>{icon}</View>}
      <Text
        style={[
          {
            fontFamily: theme.fonts.bodyBold,
            fontSize,
            fontWeight: '700',
            letterSpacing: 0.2,
            color: isDisabled ? '#9A9384' : v.text,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </>
  );

  return (
    <Animated.View
      style={[
        animStyle,
        variant === 'primary' && !isDisabled ? theme.shadows.sm : undefined,
        { borderRadius },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={{
          borderRadius,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: isDisabled ? '#E3D9C2' : v.bg,
          borderWidth: variant === 'ghost' ? 0 : 1.5,
          borderColor: isDisabled ? '#D3C6A8' : v.border,
        }}
      >
        {content}
      </TouchableOpacity>
    </Animated.View>
  );
}
