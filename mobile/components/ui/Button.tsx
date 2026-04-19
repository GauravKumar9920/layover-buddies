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

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: theme.colors.primary, text: '#FFFFFF' },
  secondary: { bg: '#F5F5F5', text: theme.colors.text, border: theme.colors.divider },
  danger: { bg: theme.colors.error, text: '#FFFFFF' },
  ghost: { bg: 'transparent', text: theme.colors.primary },
};

const SIZE_STYLES: Record<ButtonSize, { paddingH: number; paddingV: number; fontSize: number; borderRadius: number }> = {
  sm: { paddingH: 16, paddingV: 8, fontSize: 13, borderRadius: 8 },
  md: { paddingH: 20, paddingV: 12, fontSize: 15, borderRadius: 12 },
  lg: { paddingH: 24, paddingV: 16, fontSize: 16, borderRadius: 14 },
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

  const { bg, text, border } = VARIANT_STYLES[variant];
  const { paddingH, paddingV, fontSize, borderRadius } = SIZE_STYLES[size];

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
    hapticImpactMedium();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, [scale]);

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[
          {
            backgroundColor: isDisabled ? '#E5E7EB' : bg,
            borderRadius,
            paddingHorizontal: paddingH,
            paddingVertical: paddingV,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: border ? 1 : 0,
            borderColor: border,
            ...theme.shadows.sm,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'secondary' || variant === 'ghost' ? theme.colors.primary : '#FFFFFF'}
          />
        ) : (
          <>
            {icon && <View>{icon}</View>}
            <Text
              style={[
                {
                  fontSize,
                  fontWeight: '600',
                  color: isDisabled ? '#9CA3AF' : text,
                  letterSpacing: 0.2,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
