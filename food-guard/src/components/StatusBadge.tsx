import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import type { ResultStatus } from "@/types/ScanResult";

export function StatusBadge({ status }: { status: ResultStatus }) {
  const { colors } = useTheme();
  const color =
    status === "Avoid"
      ? colors.danger
      : status === "Possible Risk"
        ? colors.warning
        : status === "Likely OK"
          ? colors.ok
          : colors.unknown;
  const iconName =
    status === "Avoid" ? "shield-off" : status === "Possible Risk" ? "alert-triangle" : status === "Likely OK" ? "check-circle" : "help-circle";

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: colors.surface }]}>
      <Feather name={iconName} size={26} color={color} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  text: {
    fontSize: 26,
    fontWeight: "900"
  }
});
