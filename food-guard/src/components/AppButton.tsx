import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";

type AppButtonProps = {
  title: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
} & Omit<ComponentProps<typeof Pressable>, "style" | "children">;

export function AppButton({ title, icon, variant = "secondary", disabled, ...props }: AppButtonProps) {
  const { colors } = useTheme();
  const background =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : variant === "ghost"
          ? "transparent"
          : colors.surfaceStrong;
  const textColor = variant === "primary" ? colors.primaryText : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === "ghost" ? colors.border : background,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1
        }
      ]}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  text: {
    fontSize: 16,
    fontWeight: "700"
  }
});
