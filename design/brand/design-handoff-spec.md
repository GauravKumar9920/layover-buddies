# Detour — Design Handoff Specification (legacy / saffron)

> ⚠️ **Superseded — visual reskin pending.** Specs below reflect the older saffron palette. The current brand is **Detour** (cartographic "Deviation Line" identity) — see `detour-design-philosophy.md` and `detour-logo.html`. Retained until the phased reskin lands.

**Version:** 1.0  
**Last Updated:** April 2026  
**Audience:** Developers, AI Code Generators, Design-to-Dev Teams  
**Purpose:** Pixel-perfect implementation guide for beautiful, animated, and polished UI

---

## 1. Design Tokens (Exact Values)

### 1.1 Theme Configuration (Copy-Paste Ready)

```typescript
// theme.ts — paste directly into the project
export const theme = {
  colors: {
    primary: '#F97316',           // Teal (primary action, CTAs)
    primaryLight: '#E8F5F5',       // Teal light (backgrounds, badges)
    primaryDark: '#EA580C',        // Teal dark (hover, pressed states)
    accent: '#EC4899',             // Coral (secondary actions, highlights)
    accentLight: '#FFE8E8',        // Coral light (warning backgrounds)
    accentDark: '#BE185D',         // Coral dark (error states)
    background: '#FFFAF5',         // Cream (main background)
    surface: '#FFFFFF',            // White (cards, surfaces)
    text: '#0B1229',               // Charcoal (primary text)
    textSecondary: '#6B7280',      // Gray (secondary text)
    textMuted: '#9CA3AF',          // Light gray (captions, hints)
    gold: '#F59E0B',               // Gold (ratings, premium features)
    success: '#27AE60',            // Green (success states, confirmations)
    warning: '#F39C12',            // Orange (warnings, alerts)
    error: '#BE185D',              // Red (errors, destructive actions)
    purple: '#6C5CE7',             // Purple (categories, badges)
    divider: '#E5E7EB',            // Divider lines

    // Dark mode
    dark: {
      background: '#0F0F1A',       // Near-black background
      surface: '#0B1229',          // Dark surface
      card: '#252540',             // Dark card
      text: '#FFFAF5',             // Light text
      textSecondary: '#A0A0B0',    // Muted light text
      divider: '#3D3D4D',          // Dark divider
    }
  },

  gradients: {
    hero: ['#F97316', '#EA580C', '#0B1229'],          // Teal to charcoal
    sunset: ['#EC4899', '#F59E0B'],                    // Coral to gold
    card: ['#F97316', '#0A5F62'],                      // Teal gradient
    glass: 'rgba(255, 255, 255, 0.15)',                // Glass morphism
    dark: ['#0B1229', '#0F0F1A'],                      // Dark mode gradient
  },

  spacing: {
    xs: 4,                  // Extra small gaps
    sm: 8,                  // Small gaps
    md: 12,                 // Medium gaps
    lg: 16,                 // Large gaps (standard)
    xl: 24,                 // Extra large gaps
    xxl: 32,                // Double extra large
    xxxl: 48,               // Triple extra large (hero sections)
  },

  borderRadius: {
    sm: 8,                  // Small radius (buttons, tags)
    md: 12,                 // Medium radius (cards)
    lg: 16,                 // Large radius (primary cards)
    xl: 24,                 // Extra large radius (modals)
    full: 9999,             // Circular (avatars, pills)
  },

  shadows: {
    // React Native shadow format (iOS + Android elevation)
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 32,
      elevation: 12,
    },
  },

  typography: {
    // Format: { fontSize, fontWeight, lineHeight, letterSpacing }
    hero: {
      fontSize: 40,
      fontWeight: '800',
      lineHeight: 48,
      letterSpacing: -1,
    },
    h1: {
      fontSize: 32,
      fontWeight: '700',
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    },
    bodyBold: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
    },
    small: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    // Price display (large, bold)
    price: {
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 34,
      letterSpacing: -0.5,
    },
  },

  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    floating: 30,
    modal: 40,
    toast: 50,
    topmost: 100,
  },
};
```

### 1.2 Color Usage Guidelines

| Color | Primary Use | Secondary Use |
|-------|-------------|---------------|
| **Teal (#F97316)** | CTAs, "Request Guide" button, active navigation | Card borders, emphasis |
| **Coral (#EC4899)** | Secondary CTAs, SOS button, error states | Badges, highlights |
| **Gold (#F59E0B)** | Star ratings, premium badges, earned rewards | Special promotions |
| **Purple (#6C5CE7)** | Category tags (history, art, culture), filters | Notifications, features |
| **Charcoal (#0B1229)** | Primary text (>90% of text) | Hero sections background |
| **Cream (#FFFAF5)** | Main app background | Large surface areas |
| **White (#FFFFFF)** | Card surfaces, modal backgrounds | Text input backgrounds |

---

## 2. Animation Specifications (react-native-reanimated v3)

All animations use **react-native-reanimated** for GPU-accelerated 60fps performance.

### 2.1 Button Press (Spring Scale)

**Used In:** All CTAs, cards, list items

```typescript
import { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useCallback } from 'react';

export const useButtonPressAnimation = () => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.96, {
      damping: 15,
      stiffness: 150,
      mass: 1,
    });
  }, []);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
      mass: 1,
    });
  }, []);

  return { animatedStyle, onPressIn, onPressOut };
};

// Usage in component:
// <Animated.View style={[styles.button, animatedStyle]} onTouchStart={onPressIn} onTouchEnd={onPressOut}>
```

**Performance:** 16ms interaction → 60fps spring, 200ms total duration

---

### 2.2 List Card Stagger (Entrance Animation)

**Used In:** Guide cards, booking list, reviews, experiences

```typescript
import { useAnimatedStyle, withDelay, withSpring, withTiming, useSharedValue, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

export const useCardStaggerAnimation = (index: number) => {
  const translateY = useSharedValue(30);  // Start 30px down
  const opacity = useSharedValue(0);      // Start invisible

  useEffect(() => {
    const staggerDelay = index * 100;     // Each card waits 100ms longer
    
    // Animate translate
    translateY.value = withDelay(
      staggerDelay,
      withSpring(0, {
        damping: 20,
        stiffness: 90,
        mass: 1,
      })
    );

    // Animate opacity
    opacity.value = withDelay(
      staggerDelay,
      withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // ease-out
      })
    );
  }, [index]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
};

// Usage in FlatList:
// <Animated.View style={useCardStaggerAnimation(index)}>
//   <GuideCard ... />
// </Animated.View>
```

**Timing:** Stagger 100ms per card. Total list load: first card at 400ms, last card (10th) at 1400ms.

---

### 2.3 Skeleton Shimmer (Loading State)

**Used In:** Image placeholders, profile loading, list skeletons

```typescript
import { useAnimatedStyle, withRepeat, withTiming, useSharedValue, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

export const useShimmerAnimation = () => {
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,     // Repeat infinitely
      false   // Do not reverse
    );
  }, []);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 200 }], // 200dp shimmer width
  }));
};

// Usage:
// <View style={styles.skeletonCard}>
//   <Animated.View style={useShimmerAnimation()}>
//     <LinearGradient
//       colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
//       start={{ x: 0, y: 0 }}
//       end={{ x: 1, y: 0 }}
//       style={{ width: 200, height: '100%' }}
//     />
//   </Animated.View>
// </View>
```

**Effect:** Shimmer moves left-to-right continuously. Duration: 1.5 seconds per loop.

---

### 2.4 Page Transition (expo-router)

**Used In:** Navigation between screens

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',    // Android + iOS consistent
        animationDuration: 300,            // 300ms transition
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFAF5' },
      }}
    >
      <Stack.Screen name="guides" />
      <Stack.Screen name="guide/[id]" />
      <Stack.Screen name="booking" />
    </Stack>
  );
}

// For modal screens:
// <Stack.Screen
//   name="modal/[action]"
//   options={{
//     presentation: 'modal',
//     animationEnabled: true,
//     animationDuration: 400,
//   }}
// />
```

**Timing:** 300ms for standard transitions, 400ms for modals.

---

### 2.5 Star Rating Animation (Sequence)

**Used In:** Guide profile ratings, review stars, guide discovery

```typescript
import { useAnimatedStyle, withDelay, withSequence, withSpring, withTiming, useSharedValue } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

export const useStarRatingAnimation = (rating: number) => {
  const [starScales, setStarScales] = useState<SharedValue<number>[]>([]);

  useEffect(() => {
    const scales = Array(5)
      .fill(0)
      .map(() => useSharedValue(0));

    scales.forEach((scale, i) => {
      if (i < rating) {
        scale.value = withDelay(
          i * 100,  // 100ms per star
          withSequence(
            withSpring(1.3, { damping: 8, stiffness: 150, mass: 0.8 }),   // Bounce up
            withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 })     // Settle
          )
        );
      }
    });

    setStarScales(scales);
  }, [rating]);

  return starScales.map(scale => useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  })));
};

// Usage:
// const starStyles = useStarRatingAnimation(rating);
// {[1, 2, 3, 4, 5].map((i) => (
//   <Animated.Text style={[styles.star, starStyles[i - 1]]}>★</Animated.Text>
// ))}
```

**Timing:** Each star scales up + bounces: 200ms per star, total 1000ms for 5-star rating.

---

### 2.6 Counter Animation (Stats)

**Used In:** Trip count, earnings, guided count on profile

```typescript
import { useAnimatedStyle, withTiming, useSharedValue, interpolate } from 'react-native-reanimated';
import { useEffect } from 'react';

export const useCounterAnimation = (targetValue: number, duration: number = 1200) => {
  const displayValue = useSharedValue(0);

  useEffect(() => {
    displayValue.value = withTiming(targetValue, {
      duration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // cubic-bezier ease
    });
  }, [targetValue]);

  return displayValue;
};

// Usage with react-native-reanimated Text:
// import { Text as ReanimatedText } from 'react-native-reanimated';
// const animatedValue = useCounterAnimation(48);
// <ReanimatedText>
//   {interpolate(animatedValue.value, [0, targetValue], [0, targetValue])}
// </ReanimatedText>

// For React Native Text without reanimated text:
const animatedValue = useCounterAnimation(48);
const displayCounter = () => Math.floor(animatedValue.value);
// Update state via useSharedValue listener
```

**Timing:** 1.2 seconds for smooth count-up animation.

---

### 2.7 Confetti Celebration (Booking Success)

**Used In:** Successful booking confirmation, referral rewards

```typescript
import ConfettiCannon from 'react-native-confetti-cannon';

// In your booking success modal:
export const BookingSuccessScreen = () => {
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    // Trigger confetti after modal appears (200ms delay)
    const timer = setTimeout(() => {
      confettiRef.current?.start();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ConfettiCannon
        ref={confettiRef}
        count={60}
        origin={{ x: width / 2, y: height / 2 }}
        fallSpeed={3000}       // 3 seconds to fall
        explosionSpeed={1200}   // Spread in 1.2 seconds
        colors={['#F97316', '#EC4899', '#F59E0B', '#6C5CE7']} // Brand colors
        autoStart={false}
      />
      {/* Success content */}
    </View>
  );
};

// Configuration:
// - Count: 60-80 particles
// - Duration: 3 seconds fall time
// - Colors: Only brand colors (teal, coral, gold, purple)
// - Density: Higher on bottom half of screen
```

**Effect:** Bursts 60 confetti particles from center, spreads in 1.2s, falls for 3s.

---

### 2.8 Bottom Sheet Spring

**Used In:** Booking details, filter options, chat messages

```typescript
import BottomSheet, { useBottomSheetInternal, useDynamicSnapPoints } from '@gorhom/bottom-sheet';
import { useMemo } from 'react';

export const FilterBottomSheet = () => {
  const snapPoints = useMemo(() => ['25%', '60%', '90%'], []);

  return (
    <BottomSheet
      snapPoints={snapPoints}
      animationConfigs={{
        damping: 50,          // 0-100, higher = more damping
        stiffness: 500,       // Higher = snappier
        mass: 1,
      }}
      backgroundStyle={{
        backgroundColor: '#FFFFFF',
      }}
      handleIndicatorStyle={{
        backgroundColor: '#D1D5DB',
        width: 40,
        height: 4,
      }}
    >
      {/* Content */}
    </BottomSheet>
  );
};

// Snap points: 25% (peek), 60% (half), 90% (full)
// Damping: 50 for smooth spring without excessive bounce
```

**Physics:** Damping 50, stiffness 500 = smooth spring, settles in 300-400ms.

---

### 2.9 Parallax Hero Image

**Used In:** Guide profile header, home hero banner

```typescript
import { useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

export const ParallaxHero = ({ scrollY, imageHeight = 240 }) => {
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, imageHeight],
          [0, imageHeight * 0.5],  // 0.5x parallax speed
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(
      scrollY.value,
      [0, imageHeight],
      [1, 0.3],  // Fade to 30% opacity
      Extrapolate.CLAMP
    ),
  }));

  return (
    <Animated.View style={[styles.heroImage, imageStyle]}>
      <Image source={require('...')} style={{ width: '100%', height: imageHeight }} />
    </Animated.View>
  );
};

// Usage in ScrollView with animated scroll:
// const scrollY = useSharedValue(0);
// <Animated.ScrollView
//   onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
// >
//   <ParallaxHero scrollY={scrollY} />
// </Animated.ScrollView>
```

**Effect:** Image moves at half scroll speed, creating depth. Opacity reduces by 70% at bottom.

---

### 2.10 Pulse/Glow Animation (SOS Button)

**Used In:** Emergency SOS button, attention-grabbing elements

```typescript
import { useAnimatedStyle, withRepeat, withSequence, withTiming, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import Animated from 'react-native-reanimated';

export const usePulseAnimation = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1
    );
  }, []);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
};

// Usage:
// <Animated.View style={[styles.sosButton, usePulseAnimation()]}>
//   <Icon name="alert" color="white" size={28} />
// </Animated.View>

// Styling:
// sosButton: {
//   width: 64,
//   height: 64,
//   borderRadius: 32,
//   backgroundColor: '#EC4899',
//   shadowColor: '#BE185D',
//   shadowOffset: { width: 0, height: 0 },
//   shadowOpacity: 0.6,
//   shadowRadius: 20,
//   elevation: 12,
// }
```

**Effect:** Scales 1→1.15, opacity 1→0.7, repeats every 1.2 seconds. Infinite loop.

---

### 2.11 Floating Action Button Entrance

**Used In:** FABs for new message, new booking

```typescript
import { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

export const useFABEntrance = (shouldShow: boolean) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (shouldShow) {
      scale.value = withSpring(1, { damping: 15, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [shouldShow]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
};
```

**Timing:** Spring in 300-400ms when visible, animate out 150ms when hidden.

---

### 2.12 Haptic Feedback Integration

**Used In:** All button presses, confirmations, errors

```typescript
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export const useHapticFeedback = () => {
  const tapHeavy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const tapMedium = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const tapLight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const notificationSuccess = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const notificationError = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  return { tapHeavy, tapMedium, tapLight, notificationSuccess, notificationError };
};

// Usage:
// const haptics = useHapticFeedback();
// 
// <Pressable onPress={() => { haptics.tapHeavy(); makeBooking(); }} />
// <Pressable onPress={() => { haptics.notificationSuccess(); confirmBooking(); }} />
```

**Guidelines:**
- **Heavy:** CTA press (Request Guide, Confirm Booking)
- **Medium:** Secondary actions (filter, like, message)
- **Light:** Toggle, switch, minor interactions
- **Success:** Booking confirmed, message sent, reward earned
- **Error:** Validation failure, booking rejected, connection lost

---

## 3. Component Implementation Guide

Every component includes exact dimensions, spacing, animations, and states.

### 3.1 GuideCard Component

**Location:** `src/components/GuideCard.tsx`

#### Layout Structure

```
┌────────────────────────────────┐
│ Hero Image (h-40, bg gradient) │  ← Lazy-loaded with blurhash
├────────────────────────────────┤
│          Avatar (-mt-8)         │  ← Overlaps image by 32px
├────────────────────────────────┤
│ Name (text-lg, font-bold)      │
│ University (text-sm, gray)     │
│ ★★★★☆ 4.8 (42 reviews)         │  ← Animated star fill
│                                │
│ #History #Culture #Photography │  ← Animated tag entrance
│                                │
│ ₹2,500 · 2h tour | Fast reply  │
└────────────────────────────────┘
```

#### Styling (NativeWind/Tailwind)

```typescript
export const GuideCard = ({ guide, onPress }: GuideCardProps) => {
  const { animatedStyle, onPressIn, onPressOut } = useButtonPressAnimation();
  const cardStaggerStyle = useCardStaggerAnimation(guide.index);

  return (
    <Animated.View style={cardStaggerStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View
          style={[
            {
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
            },
            animatedStyle,
          ]}
        >
          {/* Hero Image */}
          <View className="relative h-40 bg-gray-200 overflow-hidden">
            <Image
              source={{
                uri: guide.heroImage,
                blurhash: guide.blurhash,
              }}
              placeholder={{ blurhash: guide.blurhash }}
              contentFit="cover"
              className="w-full h-full"
            />
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              className="absolute inset-0"
            />
          </View>

          {/* Avatar Badge (overlaps) */}
          <View className="px-4">
            <View className="flex-row items-end -mt-8">
              <Image
                source={{ uri: guide.avatar }}
                className="w-16 h-16 rounded-full border-4 border-white"
                contentFit="cover"
              />
              {guide.isVerified && (
                <View className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                  <CheckIcon size={12} color="white" weight="bold" />
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <View className="px-4 pb-4 mt-3">
            {/* Name + University */}
            <Text className="text-lg font-bold text-charcoal">
              {guide.name}
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              {guide.university}
            </Text>

            {/* Rating */}
            <View className="flex-row items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Animated.Text
                  key={i}
                  className="text-gold text-lg"
                  style={useStarRatingAnimation(guide.rating)[i - 1]}
                >
                  {i <= Math.floor(guide.rating) ? '★' : '☆'}
                </Animated.Text>
              ))}
              <Text className="text-xs text-gray-400 ml-1">
                {guide.rating.toFixed(1)} ({guide.reviewCount})
              </Text>
            </View>

            {/* Category Tags */}
            <View className="flex-row flex-wrap gap-2 mt-3">
              {guide.categories.map((category, i) => (
                <View
                  key={i}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    categoryColors[category]
                  }`}
                >
                  <Text>{category}</Text>
                </View>
              ))}
            </View>

            {/* Price + Response */}
            <View className="flex-row justify-between items-center mt-3">
              <Text className="text-lg font-bold text-teal">
                ₹{guide.pricePerHour}/hr
              </Text>
              <Text className="text-xs text-gray-400">
                ⚡ Fast reply
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

// Category color map:
const categoryColors = {
  'History': 'bg-purple-100',
  'Culture': 'bg-pink-100',
  'Food': 'bg-orange-100',
  'Photography': 'bg-blue-100',
  'Art': 'bg-yellow-100',
  'Nature': 'bg-green-100',
};
```

#### States & Animations

| State | Visual Effect |
|-------|---------------|
| **Default** | Scale: 1, opacity: 1, shadow: md |
| **Pressed** | Scale: 0.96 (spring), shadow: xl |
| **Loading** | Skeleton shimmer, image blurhash visible |
| **Error** | Gray overlay, placeholder icon |

**Stagger Timing:** Card `index * 100ms` delay from list mount.

---

### 3.2 BookingPriceBreakdown Component

**Location:** `src/components/BookingPriceBreakdown.tsx`

#### Layout

```
┌─────────────────────────────┐
│ Guide Fee        ₹2,500 × 2 │
│ Subtotal                    │  ← Light gray text
├─────────────────────────────┤
│ Platform Fee                │
│ (included for first booking) │
├─────────────────────────────┤
│ Total              ₹5,000   │  ← Bold, large, teal
│ ≈ $60 USD                   │  ← Gray, small
└─────────────────────────────┘
```

#### Implementation

```typescript
export const BookingPriceBreakdown = ({
  hourlyRate,
  hours,
  platformFee = 0,
  discountCode = null,
}: BookingPriceBreakdownProps) => {
  const subtotal = hourlyRate * hours;
  const total = subtotal + platformFee - (discountCode?.amount || 0);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          ...theme.shadows.md,
        },
        useCardStaggerAnimation(0), // Fade-in animation
      ]}
    >
      {/* Line Item */}
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 text-sm">
          Guide Fee ({hours}h × ₹{hourlyRate})
        </Text>
        <Text className="text-charcoal font-semibold text-sm">
          ₹{subtotal.toLocaleString()}
        </Text>
      </View>

      {platformFee > 0 && (
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600 text-sm">Platform Fee</Text>
          <Text className="text-charcoal font-semibold text-sm">
            +₹{platformFee.toLocaleString()}
          </Text>
        </View>
      )}

      {discountCode && (
        <View className="flex-row justify-between mb-2 bg-green-50 p-2 rounded">
          <Text className="text-green-700 text-sm font-medium">
            Discount ({discountCode.code})
          </Text>
          <Text className="text-green-700 font-semibold text-sm">
            -₹{discountCode.amount.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View className="h-px bg-gray-100 my-3" />

      {/* Total */}
      <View className="flex-row justify-between">
        <Text className="text-charcoal font-bold text-lg">Total</Text>
        <View>
          <Text className="text-teal font-bold text-xl text-right">
            ₹{total.toLocaleString()}
          </Text>
          <Text className="text-gray-400 text-xs text-right mt-1">
            ≈ ${(total / 85).toFixed(2)} USD
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};
```

#### Animation

- **Entrance:** Opacity 0→1, fade-in 400ms on mount
- **Stagger:** Each line item staggered 50ms apart if prices update
- **Update:** Price change slides in from bottom, 300ms

---

### 3.3 SOS Emergency Button

**Location:** `src/components/SOSButton.tsx`

#### Dimensions

```
┌──────────────────┐
│                  │
│    ⚠️ Emergency  │  64x64 dp, centered in bottom-right
│                  │
└──────────────────┘
```

#### Implementation

```typescript
export const SOSButton = ({ onPress }: SOSButtonProps) => {
  const { tapHeavy, notificationError } = useHapticFeedback();
  const pulseStyle = usePulseAnimation();
  const { animatedStyle, onPressIn, onPressOut } = useButtonPressAnimation();

  const handlePress = () => {
    tapHeavy();
    notificationError();
    onPress();
  };

  return (
    <View className="absolute bottom-8 right-8 z-50">
      {/* Pulse background */}
      <Animated.View
        style={[
          {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#EC4899',
            justifyContent: 'center',
            alignItems: 'center',
            ...theme.shadows.xl,
            shadowColor: '#BE185D',
          },
          pulseStyle,
        ]}
      >
        {/* Inner button (for press) */}
        <Pressable
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <Animated.View
            style={[
              {
                width: '100%',
                height: '100%',
                borderRadius: 32,
                backgroundColor: '#EC4899',
                justifyContent: 'center',
                alignItems: 'center',
              },
              animatedStyle,
            ]}
          >
            <AlertCircleIcon size={28} color="white" weight="fill" />
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Glow effect */}
      <View
        style={{
          position: 'absolute',
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: 'rgba(229, 85, 85, 0.2)',
          shadowColor: '#BE185D',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 12,
        }}
      />
    </View>
  );
};

// Tailwind fallback (if using purely NativeWind):
// className="absolute bottom-8 right-8 w-16 h-16 rounded-full bg-red-500 
//            items-center justify-center shadow-xl z-50"
```

#### States

| State | Effect |
|-------|--------|
| **Default** | Pulse 1s cycle, opacity 1→0.7→1 |
| **Pressed** | Scale 0.9, darker shadow |
| **Active** | Solid bright red, no pulse |

**Haptics:** Heavy impact on press + error notification sound

---

### 3.4 ReviewCard Component

**Location:** `src/components/ReviewCard.tsx`

#### Layout

```
┌─────────────────────────────────┐
│ Avatar  Name         Sep 12, 2024
│         ★★★★★ 5.0              │
│                                 │
│ "Amazing tour! Priya was super  │
│  knowledgeable and fun. Will    │
│  definitely book again!"         │
│                                 │
│ 👍 Helpful  💬 Reply           │
└─────────────────────────────────┘
```

#### Implementation

```typescript
export const ReviewCard = ({
  review,
  index,
}: ReviewCardProps) => {
  const cardStyle = useCardStaggerAnimation(index);

  return (
    <Animated.View style={cardStyle}>
      <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center gap-3">
            <Image
              source={{ uri: review.travelerAvatar }}
              className="w-10 h-10 rounded-full"
              contentFit="cover"
            />
            <View>
              <Text className="text-sm font-semibold text-charcoal">
                {review.travelerName}
              </Text>
              <Text className="text-xs text-gray-400">
                {formatDate(review.createdAt)}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500">
            {review.country}
          </Text>
        </View>

        {/* Rating */}
        <View className="flex-row gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Text
              key={i}
              className={`text-base ${
                i <= review.rating ? 'text-gold' : 'text-gray-300'
              }`}
            >
              ★
            </Text>
          ))}
          <Text className="text-xs text-gray-500 ml-2">
            {review.rating.toFixed(1)}
          </Text>
        </View>

        {/* Review Text */}
        <Text
          numberOfLines={3}
          className="text-sm text-charcoal leading-relaxed mb-3"
        >
          "{review.text}"
        </Text>

        {/* Actions */}
        <View className="flex-row gap-4">
          <Pressable className="flex-row items-center gap-1">
            <Text className="text-lg">👍</Text>
            <Text className="text-xs text-gray-600">Helpful</Text>
          </Pressable>
          <Pressable className="flex-row items-center gap-1">
            <Text className="text-lg">💬</Text>
            <Text className="text-xs text-gray-600">Reply</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
```

---

### 3.5 ItineraryCard (Horizontal Scroll)

**Location:** `src/components/ItineraryCard.tsx`

#### Dimensions

```
Width:  288 dp (w-72)
Height: Auto (min 180 dp)
Margin: 0 12 (horizontal scroll)
Radius: 16
```

#### Implementation

```typescript
export const ItineraryCard = ({
  itinerary,
  index,
}: ItineraryCardProps) => {
  return (
    <View className="w-72 mr-3 rounded-2xl overflow-hidden">
      <Pressable>
        <View className="relative">
          {/* Hero Image */}
          <Image
            source={{
              uri: itinerary.image,
              blurhash: itinerary.blurhash,
            }}
            placeholder={{ blurhash: itinerary.blurhash }}
            className="w-full h-40"
            contentFit="cover"
          />

          {/* Duration Badge */}
          <View className="absolute top-4 right-4 bg-black/60 rounded-full px-3 py-1">
            <Text className="text-white text-xs font-semibold">
              {itinerary.duration}h
            </Text>
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.4)']}
            className="absolute inset-0"
          />
        </View>

        {/* Content */}
        <View className="bg-white p-4">
          <Text className="text-base font-bold text-charcoal mb-1">
            {itinerary.title}
          </Text>
          <Text className="text-sm text-gray-600 mb-3 line-clamp-2">
            {itinerary.description}
          </Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-teal font-bold">
              ₹{itinerary.price}
            </Text>
            <View className="flex-row items-center gap-1">
              <StarIcon size={14} weight="fill" color="#F59E0B" />
              <Text className="text-xs font-semibold text-gray-700">
                {itinerary.rating}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
};
```

---

## 4. Screen Layout Specifications

### 4.1 Guide Profile Screen (`guide/[id].tsx`)

#### Full Layout Tree

```
SafeAreaView (bg-cream)
├── Animated.ScrollView
│   ├── HeroSection
│   │   ├── ParallaxImage (h-60, absolute, full)
│   │   │   └── Image (cover, blurhash placeholder)
│   │   ├── GradientOverlay (dark teal gradient, bottom)
│   │   └── HeaderButtons (absolute, top-12)
│   │       ├── BackButton (left-4, circular, semi-transparent)
│   │       └── ShareButton (right-4, circular, semi-transparent)
│   │
│   ├── ProfileCard (px-5, -mt-16, relative z-10)
│   │   ├── Avatar (w-24, h-24, border-4 white, -mt-12)
│   │   ├── VerifiedBadges (flex-row, gap-2, mt-3)
│   │   │   ├── Badge "Verified" (bg-blue, text-white)
│   │   │   ├── Badge "Super Guide" (bg-gold, text-charcoal)
│   │   │   └── Badge "Fast Reply" (bg-green, text-white)
│   │   ├── Name (text-2xl, font-bold, mt-2)
│   │   ├── University (text-gray-500, mt-1)
│   │   └── StatsRow (flex-row, justify-around, mt-6, py-4, border-gray-200)
│   │       ├── Stat
│   │       │   ├── Number "48" (text-xl, font-bold, teal, animated counter)
│   │       │   └── Label "Trips" (text-xs, gray-500)
│   │       ├── Stat (verified checkmark)
│   │       └── Stat (earnings, animated counter)
│   │
│   ├── AboutSection (px-5, mt-8)
│   │   ├── SectionTitle "About Priya" (text-lg, font-bold)
│   │   └── BioText (text-sm, expandable, see more link)
│   │
│   ├── LanguagesSection (px-5, mt-8)
│   │   ├── SectionTitle "Languages"
│   │   └── LanguageBars (animated width, h-2)
│   │       ├── Bar "Hindi" (90%, bg-teal)
│   │       ├── Bar "English" (100%, bg-teal)
│   │       └── Bar "Spanish" (40%, bg-gray-300)
│   │
│   ├── SkillsSection (px-5, mt-8)
│   │   ├── SectionTitle "Skills & Interests"
│   │   └── ChipRow (flex-wrap, gap-2)
│   │       ├── Chip "Photography" (bg-blue-100, text-blue-700)
│   │       ├── Chip "History" (bg-purple-100, text-purple-700)
│   │       └── ...more chips
│   │
│   ├── ExperiencesSection (mt-8)
│   │   ├── SectionTitle "My Experiences" (px-5)
│   │   └── HorizontalScroll (showsHorizontalScrollIndicator=false)
│   │       ├── ItineraryCard (w-72, ml-5, mr-3)
│   │       ├── ItineraryCard
│   │       └── Spacer (w-5)
│   │
│   ├── ReviewsSection (px-5, mt-8)
│   │   ├── SectionTitle "What Travelers Say"
│   │   ├── ReviewCard
│   │   ├── ReviewCard
│   │   └── ViewAllReviewsButton (teal outline)
│   │
│   └── Spacer (h-32, for floating button clearance)
│
└── StickyBottomBar (absolute, bottom-0, h-24, bg-white, border-t)
    ├── Divider (h-px, bg-gray-200)
    ├── PriceInfo (px-5, py-3, flex-row justify-between)
    │   ├── Text "₹2,500 per hour"
    │   └── Text "2 hours minimum"
    └── CTAButton (mx-5, mb-4, bg-teal, rounded-2xl, h-14)
        └── Text "Request Priya ✨"
```

#### Screen Dimensions

```
// iPhone 14 base (used for all calculations)
Screen width: 390 dp
Safe area: 16 dp padding on each side (358 dp usable)
Hero height: 240 dp
Avatar size: 96 dp (positioned -64 dp over hero)
Card spacing: 16 dp (lg from theme)
Bottom button area: 96 dp (needs clearance)
```

#### Scroll Behavior

```typescript
export const GuideProfileScreen = ({ id }: GuideProfileScreenProps) => {
  const scrollY = useSharedValue(0);
  const { guide, isLoading } = useGuideData(id);

  if (isLoading) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        showsVerticalScrollIndicator={false}
      >
        {/* HeroSection with parallax */}
        <View className="relative h-60 bg-gray-300 overflow-hidden">
          <ParallaxHero scrollY={scrollY} imageHeight={240} />
          
          {/* Back + Share buttons */}
          <View className="absolute top-12 left-4 right-4 flex-row justify-between z-20">
            <BackButton />
            <ShareButton />
          </View>
        </View>

        {/* Profile Card */}
        <View className="px-5 -mt-16 relative z-10 bg-cream pb-4">
          {/* Avatar + Info */}
          <View>
            <Image
              source={{ uri: guide.avatar }}
              className="w-24 h-24 rounded-full border-4 border-white -mt-12"
            />
            {/* Verified badges */}
            {/* Name, University */}
            {/* Stats row */}
          </View>

          {/* About section */}
          {/* Languages section */}
          {/* Skills section */}
          {/* Experiences */}
          {/* Reviews */}
        </View>
      </Animated.ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <View className="px-5 py-3 flex-row justify-between">
          <View>
            <Text className="text-base font-bold text-teal">
              ₹{guide.pricePerHour}/hr
            </Text>
            <Text className="text-xs text-gray-500">2h minimum</Text>
          </View>
        </View>
        <Pressable className="mx-5 mb-4 bg-teal rounded-2xl h-14 items-center justify-center">
          <Text className="text-white font-bold text-base">
            Request Priya ✨
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
```

---

### 4.2 Home/Discovery Screen (`index.tsx`)

```
SafeAreaView (bg-cream)
├── Animated.ScrollView
│   ├── HeroBanner
│   │   ├── Lottie (wave animation, 3s loop)
│   │   ├── GradientOverlay (teal to dark)
│   │   ├── Headline "Explore Mumbai with Local Buddies"
│   │   └── SearchBar (tappable, navigates to search screen)
│   │
│   ├── QuickFilters (px-5, mt-4, horizontal scroll)
│   │   ├── Chip "All" (active, bg-teal)
│   │   ├── Chip "Food" (bg-gray-100)
│   │   ├── Chip "History" (bg-gray-100)
│   │   └── Chip "Photo" (bg-gray-100)
│   │
│   ├── GuideListSection (mt-4)
│   │   ├── SectionTitle "Guides Near You"
│   │   └── FlatList (FlashList for perf)
│   │       ├── GuideCard (staggered entrance)
│   │       └── GuideCard
│   │
│   ├── PromoSection (px-5, mt-6, bg-gradient)
│   │   ├── Text "Earn as a Guide"
│   │   └── CTAButton (white, outline)
│   │
│   └── Spacer (h-24)
│
└── BottomTabBar
```

---

## 5. Image & Asset Guidelines

### 5.1 Photography Requirements

```
Guide Hero Images:
  Aspect Ratio: 16:9 (390×220 dp)
  Format: JPEG, 80% quality, 60-80 KB
  Content: City landmark + guide (shallow depth)
  Placeholder: Blurhash string stored in DB
  
Profile Avatar:
  Aspect Ratio: 1:1 (96×96 dp)
  Format: PNG with transparency or JPEG
  Quality: 85%, 25-35 KB
  
Gallery Images:
  Aspect Ratio: 4:3 (300×225 dp minimum)
  Format: JPEG, 80%, 40-60 KB each
  Lazy load with blurhash, CDN transform on fetch
```

### 5.2 Required Blurhash Strings

Every image in the database must have a blurhash field:

```typescript
// Example in Supabase:
CREATE TABLE guides (
  id UUID PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  avatar_blurhash TEXT,  // e.g., "UeKUpXxuo]#M_3t757oJodS$$iork卡U^ Tony"
  hero_image_url TEXT,
  hero_image_blurhash TEXT,
  created_at TIMESTAMP
);

// Generate blurhash client-side:
import { encode } from 'blurhash';
const blurhash = encode(imageData, 4, 3); // components: 4x3
```

### 5.3 Required Lottie Animations

Download these from [LottieFiles](https://lottiefiles.com) and store in `assets/animations/`:

```
animations/
├── confetti.json          // 60 particles, brand colors, 3s duration
├── loading.json           // Pulse/spinner, 1.2s loop
├── check-success.json     // Animated checkmark, 800ms
├── star-burst.json        // 5 stars radiating, 1s
├── gift-open.json         // Gift box opening, 1.5s
├── location-pulse.json    // Pulsing location pin, 2s loop
└── empty-search.json      // Empty state illustration, 2s loop
```

### 5.4 Custom SVG Icons

Create/use these icons (SVG format, 24×24 dp):

```
icons/
├── auto-rickshaw.svg      // Three-wheeler icon, teal stroke
├── chai-cup.svg           // Steaming cup, warm colors
├── gateway-india.svg      // Gateway of India silhouette
├── buddy-handshake.svg    // Two hands shaking, teal
├── verified-badge.svg     // Checkmark in circle
├── star-full.svg          // Filled star, gold
├── star-empty.svg         // Empty star, gray
├── location-pin.svg       // Location marker
└── heart-fill.svg         // Filled heart, coral
```

---

## 6. NativeWind (Tailwind) Custom Config

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand colors
        teal: {
          DEFAULT: '#F97316',
          50: '#E8F5F5',
          100: '#D0EBEB',
          200: '#A1D7D7',
          600: '#EA580C',
          700: '#073D40',
        },
        coral: {
          DEFAULT: '#EC4899',
          50: '#FFE8E8',
          100: '#FFD1D1',
          600: '#BE185D',
          700: '#CC4444',
        },
        gold: '#F59E0B',
        charcoal: '#0B1229',
        cream: '#FFFAF5',
        purple: {
          DEFAULT: '#6C5CE7',
          50: '#F5F3FF',
          100: '#EBE7FF',
        },

        // Semantic colors
        success: '#27AE60',
        warning: '#F39C12',
        error: '#BE185D',
      },

      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },

      spacing: {
        // Using theme.spacing values
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'xxl': '32px',
        'xxxl': '48px',
      },

      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['20px', { lineHeight: '28px' }],
        'xl': ['24px', { lineHeight: '32px' }],
        '2xl': ['32px', { lineHeight: '40px' }],
        'hero': ['40px', { lineHeight: '48px' }],
      },

      fontWeight: {
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
      },

      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },

      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'xl': '0 12px 32px rgba(0, 0, 0, 0.16)',
        'glow-teal': '0 0 20px rgba(13, 115, 119, 0.3)',
        'glow-coral': '0 0 20px rgba(255, 107, 107, 0.4)',
      },
    },
  },
  plugins: [
    require('nativewind/plugin'),
  ],
};
```

---

## 7. Performance Requirements

### 7.1 Metrics & Targets

```
Metric                      Target          Measurement
─────────────────────────────────────────────────────────
First Meaningful Paint      < 1.5s          From cold start
Interaction to Paint        < 100ms         From tap to response
Animation Frame Rate        60fps           No drops below 55fps
Image Load Time            < 500ms         Blurhash → full image
List Scroll Performance    60fps           With FlashList
Bundle Size (initial)       < 15 MB         Download size
```

### 7.2 Image Optimization

```typescript
// Always load images with blurhash placeholder:
<Image
  source={{ uri: imageUrl, blurhash: blurhashString }}
  placeholder={{ blurhash: blurhashString }}
  contentFit="cover"
  cachePolicy="memory-disk"
  priority="high"  // For above-the-fold images
/>

// Use CDN transforms for responsive sizes:
// Original: https://cdn.supabase.io/guides/priya-hero.jpg
// Transformed: https://cdn.supabase.io/guides/priya-hero.jpg?width=390&quality=80
```

### 7.3 Code Splitting & Lazy Loading

```typescript
// Lazy load screens:
const GuideProfileScreen = lazy(() => import('./guide/[id]'));

// Use React.memo + useCallback to prevent re-renders:
export const GuideCard = memo(({ guide, onPress }: GuideCardProps) => {
  const handlePress = useCallback(() => onPress(guide.id), [guide.id]);
  // Component implementation
});

// Use useMemo for expensive calculations:
const filteredGuides = useMemo(
  () => guides.filter(g => g.category === selectedCategory),
  [guides, selectedCategory]
);
```

### 7.4 Skeleton Loading Pattern

```typescript
// Show skeleton for max 50ms, then fade to content within 2s
export const GuideCardSkeleton = () => (
  <View className="bg-white rounded-2xl overflow-hidden shadow-md">
    {/* Shimmer image */}
    <View className="h-40 bg-gray-200 relative">
      <Animated.View style={useShimmerAnimation()}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
          className="absolute inset-0"
        />
      </Animated.View>
    </View>

    {/* Shimmer text lines */}
    <View className="p-4 gap-3">
      <View className="h-4 bg-gray-200 rounded-md w-3/4" />
      <View className="h-3 bg-gray-200 rounded-md w-1/2" />
      <View className="h-3 bg-gray-200 rounded-md w-2/3" />
    </View>
  </View>
);
```

### 7.5 FlashList Usage (Instead of FlatList)

```typescript
import { FlashList } from '@shopify/flash-list';

// In component:
<FlashList
  data={guides}
  renderItem={({ item, index }) => (
    <Animated.View style={useCardStaggerAnimation(index)}>
      <GuideCard guide={item} />
    </Animated.View>
  )}
  estimatedItemSize={280}  // Average card height for virtualization
  scrollEventThrottle={16}
  showsVerticalScrollIndicator={false}
/>
```

---

## 8. Key Libraries & Dependencies

### 8.1 Required Packages

```json
{
  "react-native-reanimated": "~3.10.0",
  "react-native-gesture-handler": "~2.16.0",
  "@gorhom/bottom-sheet": "^4.6.0",
  "expo-image": "~1.12.0",
  "expo-blur": "~13.0.0",
  "expo-haptics": "~13.0.0",
  "expo-linear-gradient": "~13.0.0",
  "lottie-react-native": "~6.7.0",
  "@shopify/flash-list": "~1.6.0",
  "nativewind": "^4.0.0",
  "react-native-svg": "~15.2.0",
  "react-native-confetti-cannon": "^1.5.2",
  "blurhash": "^2.0.5",
  "date-fns": "^3.0.0"
}
```

### 8.2 Reanimated Setup (Critical)

```typescript
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
```

### 8.3 Icon Library

```bash
# Install Phosphor Icons (recommended for brand consistency)
npx expo install phosphor-react-native

# Usage:
import { Star, Heart, MapPin, AlertCircle } from 'phosphor-react-native';

<Star size={24} color="#F59E0B" weight="fill" />
```

---

## 9. Accessibility & Dark Mode

### 9.1 Dark Mode Support

```typescript
// Use expo-system-ui + React Context
import { useColorScheme } from 'react-native';

export const ColorSchemeContext = createContext('light');

export const useTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? theme.dark : theme.colors;
};

// Apply dynamically:
<View style={{
  backgroundColor: useTheme().background,
  color: useTheme().text,
}}>
```

### 9.2 Accessibility Labels

```typescript
// Every interactive element needs accessibilityLabel:
<Pressable
  onPress={handlePress}
  accessible={true}
  accessibilityLabel="Request Priya for guide"
  accessibilityHint="Double tap to request"
  accessibilityRole="button"
>
  <Text>Request Priya ✨</Text>
</Pressable>

// For images:
<Image
  source={imageSource}
  accessibilityLabel={`${guide.name}'s profile photo`}
/>
```

---

## 10. Implementation Checklist

Use this checklist when building screens:

- [ ] All text uses typography tokens (hero, h1, h2, body, etc.)
- [ ] All spacing uses theme.spacing (xs, sm, md, lg, xl, xxl)
- [ ] All colors use theme.colors (primary, accent, text, etc.)
- [ ] All shadows use theme.shadows (sm, md, lg, xl)
- [ ] All border radius uses theme.borderRadius (sm, md, lg, xl, full)
- [ ] Button press uses spring scale animation (0.96x scale)
- [ ] List items use stagger animation (index * 100ms delay)
- [ ] Images have blurhash placeholders
- [ ] Images use lazy loading with contentFit="cover"
- [ ] Haptic feedback on button press (Heavy impact)
- [ ] Loading states show skeleton within 50ms
- [ ] Scroll performance tested on Android (FlashList, no FlatList)
- [ ] Dark mode colors applied via useTheme()
- [ ] Accessibility labels on all interactive elements
- [ ] Hero sections have parallax scroll (0.5x speed)
- [ ] Bottom sheets use spring animation (damping: 50)
- [ ] Animations run at 60fps (use reanimated worklets)
- [ ] Bundle size < 15MB (monitor with EAS)

---

## 11. Quick Reference: Copy-Paste Components

### Common Button

```typescript
export const PrimaryButton = ({ label, onPress }: PrimaryButtonProps) => {
  const { animatedStyle, onPressIn, onPressOut } = useButtonPressAnimation();
  const { tapHeavy } = useHapticFeedback();

  return (
    <Pressable
      onPress={() => { tapHeavy(); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View
        style={[
          {
            backgroundColor: '#F97316',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        <Text className="text-white font-bold text-base">{label}</Text>
      </Animated.View>
    </Pressable>
  );
};
```

### Common Card

```typescript
export const Card = ({ children, onPress }: CardProps) => {
  const cardStyle = useCardStaggerAnimation(0);

  return (
    <Animated.View style={cardStyle}>
      <Pressable onPress={onPress}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            ...theme.shadows.md,
            padding: theme.spacing.lg,
          }}
        >
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
};
```

---

## 12. Debugging & Quality Assurance

### 12.1 Performance Profiling

```bash
# Check frame drops during scroll
npx react-native-debugger
> Profiler tab > Record

# Check bundle size
npx eas build --platform ios --local --output=./build.ipa
# Analyze: eas-build-metadata.json
```

### 12.2 Animation Validation

- [ ] All spring animations: damping 8-20, stiffness 90-150
- [ ] All timed animations: easing cubic-bezier(0.25, 0.1, 0.25, 1)
- [ ] Parallax: 0.5x scroll speed (multiply by 0.5)
- [ ] Stagger: 100ms per item (not 50ms, not 150ms)
- [ ] Pulse: 1.2s loop (1s up, 1s down)

### 12.3 Visual QA

Screenshots for:
- [ ] Light mode (all screens)
- [ ] Dark mode (sample screens)
- [ ] Loading states (skeleton)
- [ ] Error states (empty results)
- [ ] Android (device-specific testing)
- [ ] iOS (device-specific testing)

---

## Final Notes

This specification is **pixel-perfect** and **copy-paste ready**. Every value, color, spacing, and animation is exact. There is no guessing—developers can implement directly from this document and achieve a polished, beautiful app that rivals production apps.

**Key Principle:** Animations should be **felt**, not seen. Users should perceive smoothness and responsiveness, not think about specific animations.

**Implementation Time:** ~2-3 weeks for a developer to implement all screens with this spec.

**Maintenance:** Keep this document in sync with design changes. Use version control for the design/brand folder.

---

**Generated:** April 2026  
**Version:** 1.0  
**Maintained By:** Design Team  
**Last Review:** [Date]
