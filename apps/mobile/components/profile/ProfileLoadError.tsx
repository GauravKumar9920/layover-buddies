import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import { theme } from "@/config/theme";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ProfileLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert">
      <Card
        framed
        style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(190,55,43,0.08)",
          }}
        >
          <Feather name="alert-circle" size={22} color={theme.colors.error} />
        </View>
        <Text
          style={{
            fontFamily: theme.fonts.displaySemi,
            fontSize: 18,
            color: theme.colors.text,
            textAlign: "center",
          }}
        >
          Profile unavailable
        </Text>
        <Text
          style={{
            maxWidth: 300,
            fontFamily: theme.fonts.body,
            fontSize: 13,
            lineHeight: 19,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}
        >
          {message}
        </Text>
        <Button
          title="Try again"
          variant="secondary"
          onPress={onRetry}
          style={{ alignSelf: "stretch", marginTop: 4 }}
        />
      </Card>
    </View>
  );
}
