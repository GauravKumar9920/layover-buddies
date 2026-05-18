import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/config/theme';
import { safeBack } from '@/lib/navigation';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Where to go when there's no history to pop (web refresh, deep link, etc).
   *  Defaults to the app root. Pass a more specific parent path when the
   *  default would dump the user too far away (e.g. `/(traveler)/trips`). */
  backFallback?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  light?: boolean; // White text (for dark/gradient backgrounds)
}

export function Header({
  title,
  showBack = false,
  onBack,
  backFallback = '/',
  rightAction,
  style,
  light = false,
}: HeaderProps) {
  const router = useRouter();
  const textColor = light ? '#FFFFFF' : theme.colors.text;

  function handleBack() {
    if (onBack) onBack();
    else safeBack(router, backFallback);
  }

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          height: 56,
        },
        style,
      ]}
    >
      {showBack && (
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 8 }}
        >
          <Text style={{ fontSize: 24, color: textColor, lineHeight: 28 }}>‹</Text>
        </TouchableOpacity>
      )}

      <Text
        style={{
          flex: 1,
          ...theme.typography.h3,
          color: textColor,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightAction && <View style={{ marginLeft: 8 }}>{rightAction}</View>}
    </View>
  );
}
