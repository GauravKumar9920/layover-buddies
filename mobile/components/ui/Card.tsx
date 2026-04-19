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
}

export function Card({ children, onPress, style, elevation = 'md', padding = 16 }: CardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const shadowStyle = elevation === 'none' ? {} : theme.shadows[elevation];

  if (!onPress) {
    return (
      <View
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding,
            borderWidth: 1,
            borderColor: theme.colors.divider,
            ...shadowStyle,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => scale.value = withSpring(0.97, { damping: 15, stiffness: 150 })}
        onPressOut={() => scale.value = withSpring(1, { damping: 15, stiffness: 150 })}
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding,
            borderWidth: 1,
            borderColor: theme.colors.divider,
            ...shadowStyle,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
