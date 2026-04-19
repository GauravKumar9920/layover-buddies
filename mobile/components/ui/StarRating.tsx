import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '@/config/theme';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  animate?: boolean;
}

function AnimatedStar({ filled, size, delay, animate }: { filled: boolean; size: number; delay: number; animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (animate && filled) {
      scale.value = withDelay(
        delay,
        withSequence(
          withSpring(1.3, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 12, stiffness: 120 }),
        ),
      );
    } else if (animate) {
      scale.value = 1;
    }
  }, [filled, animate, delay, scale]);

  return (
    <Animated.Text
      style={[
        {
          fontSize: size,
          color: filled ? theme.colors.gold : '#E5E7EB',
        },
        animStyle,
      ]}
    >
      ★
    </Animated.Text>
  );
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 18,
  interactive = false,
  onRate,
  animate = false,
}: StarRatingProps) {
  if (interactive) {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: maxStars }, (_, i) => (
          <TouchableOpacity key={i} onPress={() => onRate?.(i + 1)}>
            <Text style={{ fontSize: size, color: i < rating ? theme.colors.gold : '#E5E7EB' }}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: maxStars }, (_, i) => (
        <AnimatedStar
          key={i}
          filled={i < Math.round(rating)}
          size={size}
          delay={i * 100}
          animate={animate}
        />
      ))}
    </View>
  );
}
