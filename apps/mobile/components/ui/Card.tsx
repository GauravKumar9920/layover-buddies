import { View, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@/config/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
  /** Hard ink border + no shadow — the "stamped ticket" look for hero / receipt
   *  cards. Default is a soft ink hairline with a gentle shadow. */
  framed?: boolean;
}

// Subtle ink hairline that reads as a real line on the warm paper canvas.
const HAIRLINE = 'rgba(14,25,41,0.10)';

export function Card({
  children,
  onPress,
  style,
  elevation = 'md',
  padding = 16,
  framed = false,
}: CardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding,
    borderWidth: framed ? 1.5 : 1,
    borderColor: framed ? theme.colors.inkLine : HAIRLINE,
    ...(framed || elevation === 'none' ? {} : theme.shadows[elevation]),
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 15, stiffness: 150 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 15, stiffness: 150 }))}
        style={[base, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
