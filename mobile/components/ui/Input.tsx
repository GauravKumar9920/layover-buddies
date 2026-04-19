import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { theme } from '@/config/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
  rightIcon?: React.ReactNode;
}

export function Input({ label, error, hint, style, inputStyle, rightIcon, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : focused
    ? theme.colors.primary
    : theme.colors.divider;

  return (
    <View style={style}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginBottom: 6,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor,
          borderRadius: theme.borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          ...(focused ? theme.shadows.sm : {}),
        }}
      >
        <TextInput
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[
            {
              flex: 1,
              fontSize: 16,
              color: theme.colors.text,
              padding: 0,
            },
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.textMuted}
        />
        {rightIcon && <TouchableOpacity>{rightIcon}</TouchableOpacity>}
      </View>

      {error && (
        <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>
      )}
      {hint && !error && (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
}
