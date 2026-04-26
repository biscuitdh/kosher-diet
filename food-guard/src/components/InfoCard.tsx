import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";

type InfoCardProps = {
  title?: string;
  children: ReactNode;
};

export function InfoCard({ title, children }: InfoCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  title: {
    fontSize: 17,
    fontWeight: "800"
  }
});
