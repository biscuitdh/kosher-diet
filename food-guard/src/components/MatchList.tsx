import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";
import type { IngredientMatch } from "@/types/ScanResult";

export function MatchList({ matches }: { matches: readonly IngredientMatch[] }) {
  const { colors } = useTheme();

  if (matches.length === 0) {
    return <Text style={[styles.empty, { color: colors.muted }]}>No matched terms.</Text>;
  }

  return (
    <View style={styles.list}>
      {matches.map((match, index) => (
        <View key={`${match.source}-${match.term}-${index}`} style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.term, { color: colors.text }]}>
            <Text style={styles.bold}>{match.term}</Text> from {match.source}
          </Text>
          <Text style={[styles.detail, { color: colors.muted }]}>{match.explanation}</Text>
          {match.context ? <Text style={[styles.context, { color: colors.muted }]}>Context: {match.context}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10
  },
  row: {
    borderLeftWidth: 3,
    gap: 4,
    paddingLeft: 10
  },
  term: {
    fontSize: 15
  },
  bold: {
    fontWeight: "900"
  },
  detail: {
    fontSize: 13,
    lineHeight: 18
  },
  context: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17
  },
  empty: {
    fontSize: 14
  }
});
