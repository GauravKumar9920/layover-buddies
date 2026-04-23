import { useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  md: { paddingH: 20, paddingV: 13, fontSize: 15, borderRadius: 12 },
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
  const { paddingH, paddingV, fontSize, borderRadius } = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
    hapticImpactMedium();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }, [scale]);

  const sharedInnerStyle = {
    borderRadius,
    paddingHorizontal: paddingH,
    paddingVertical: paddingV,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  };

  const content = loading ? (
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
            fontWeight: '700' as const,
            letterSpacing: 0.2,
            color:
              isDisabled ? '#9CA3AF'
              : variant === 'secondary' ? theme.colors.text
              : variant === 'ghost' ? theme.colors.primary
              : '#FFFFFF',
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
        variant === 'primary' && !isDisabled
          ? {
              shadowColor: theme.colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.38,
              shadowRadius: 18,
              elevation: 6,
              borderRadius,
            }
          : undefined,
        // For non-primary variants, style goes on the wrapper
        variant !== 'primary' ? style : undefined,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={{ borderRadius }}
      >
        {variant === 'primary' && !isDisabled ? (
          <LinearGradient
            colors={theme.gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[sharedInnerStyle, style]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              sharedInnerStyle,
              {
                backgroundColor:
                  isDisabled ? '#E5E7EB'
                  : variant === 'secondary' ? theme.colors.surface
                  : variant === 'danger' ? theme.colors.error
                  : 'transparent',
                borderWidth: variant === 'secondary' ? 1.5 : 0,
                borderColor: theme.colors.divider,
                ...(variant === 'secondary' ? theme.shadows.sm : {}),
              },
            ]}
          >
            {content}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
