import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { MatchList } from "@/components/MatchList";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { analyzeProduct } from "@/rules/analyzeProduct";
import {
  createManualNote,
  getScan,
  initStorage,
  isFavorite,
  saveManualNote,
  saveProduct,
  saveScan,
  setFavorite
} from "@/services/storage";
import { useTheme } from "@/theme/theme";
import type { ScanResult } from "@/types/ScanResult";

export function ResultScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const [scan, setScan] = useState<ScanResult | undefined>();
  const [favorite, setFavoriteState] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      await initStorage();
      if (!id) {
        setLoading(false);
        return;
      }
      const loaded = await getScan(id);
      setScan(loaded);
      if (loaded) setFavoriteState(await isFavorite(loaded.productBarcode));
      setLoading(false);
    })();
  }, [id]);

  async function toggleFavorite() {
    if (!scan) return;
    const next = !favorite;
    await setFavorite(scan.productBarcode, next);
    setFavoriteState(next);
  }

  async function saveNote() {
    if (!scan || !note.trim()) return;
    const manualNote = createManualNote(scan.productBarcode, note.trim(), scan.profile.id);
    await saveManualNote(manualNote);
    const product = {
      ...scan.productSnapshot,
      manualNotes: [manualNote, ...(scan.productSnapshot.manualNotes ?? [])]
    };
    const savedProduct = await saveProduct(product);
    const nextScan = analyzeProduct(savedProduct, scan.profile);
    await saveScan(nextScan);
    setScan(nextScan);
    setNote("");
  }

  if (loading) {
    return (
      <Screen title="Result">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!scan) {
    return (
      <Screen title="Result">
        <InfoCard title="Missing result">
          <Text style={[styles.text, { color: colors.muted }]}>No saved scan result was found.</Text>
          <AppButton title="Back home" onPress={() => router.replace("/")} />
        </InfoCard>
      </Screen>
    );
  }

  const notes = scan.productSnapshot.manualNotes ?? [];

  return (
    <Screen title={scan.productName} subtitle={scan.brand ? `${scan.brand} • ${scan.productBarcode}` : scan.productBarcode}>
      <StatusBadge status={scan.status} />

      <InfoCard title="Decision">
        <Text style={[styles.text, { color: colors.text }]}>{scan.explanation}</Text>
        <Text style={[styles.warning, { color: colors.warning }]}>{scan.warning}</Text>
      </InfoCard>

      <InfoCard title="Profile">
        <Text style={[styles.text, { color: colors.text }]}>{scan.profile.name}</Text>
        <Text style={[styles.small, { color: colors.muted }]}>Rules: {scan.profile.allergyRules.join(", ")}</Text>
      </InfoCard>

      <InfoCard title="Matched terms">
        <MatchList matches={scan.matches} />
      </InfoCard>

      <InfoCard title="Kosher">
        <Text style={[styles.text, { color: colors.text }]}>{scan.kosher.explanation}</Text>
        {scan.kosher.passoverWarning ? <Text style={[styles.warning, { color: colors.warning }]}>{scan.kosher.passoverWarning}</Text> : null}
        {scan.kosher.pareveWarning ? <Text style={[styles.warning, { color: colors.warning }]}>{scan.kosher.pareveWarning}</Text> : null}
        <MatchList matches={scan.kosher.indicators} />
      </InfoCard>

      {notes.length > 0 ? (
        <InfoCard title="Family notes">
          {notes.map((item) => (
            <View key={item.id} style={[styles.note, { borderColor: colors.border }]}>
              <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </View>
          ))}
        </InfoCard>
      ) : null}

      <InfoCard title="Report / correct product info">
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Example: We checked the label on 2026-04-26. Contains paprika."
          placeholderTextColor={colors.muted}
          style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        />
        <AppButton title="Save local correction" onPress={() => void saveNote()} disabled={!note.trim()} />
      </InfoCard>

      <View style={styles.actions}>
        <AppButton
          title={favorite ? "Remove favorite" : "Favorite product"}
          icon={<Feather name="star" size={18} color={colors.text} />}
          onPress={() => void toggleFavorite()}
        />
        <AppButton title="Check another profile" onPress={() => router.replace("/")} />
        <AppButton title="Scan another barcode" variant="primary" onPress={() => router.replace("/scan")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 22
  },
  small: {
    fontSize: 13,
    lineHeight: 18
  },
  warning: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  note: {
    borderLeftWidth: 3,
    gap: 4,
    paddingLeft: 10
  },
  textArea: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 120,
    padding: 12,
    textAlignVertical: "top"
  },
  actions: {
    gap: 10
  }
});
