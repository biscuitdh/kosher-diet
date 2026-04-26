import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { Screen } from "@/components/Screen";
import { analyzeProduct } from "@/rules/analyzeProduct";
import { recognizeIngredientText } from "@/services/ocr";
import { getProduct, getProfiles, getSelectedProfile, initStorage, saveProduct, saveScan } from "@/services/storage";
import { useTheme } from "@/theme/theme";
import type { Product } from "@/types/Product";
import type { Profile } from "@/types/Profile";

export function OcrScreen() {
  const { barcode, profileId } = useLocalSearchParams<{ barcode?: string; profileId?: string }>();
  const { colors } = useTheme();
  const [product, setProduct] = useState<Product | undefined>();
  const [manualBarcode, setManualBarcode] = useState(barcode ?? "");
  const [ocrText, setOcrText] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadProfile = useCallback(async (): Promise<Profile> => {
    await initStorage();
    if (profileId) {
      const profiles = await getProfiles();
      const match = profiles.find((profile) => profile.id === profileId);
      if (match) return match;
    }
    const selected = await getSelectedProfile();
    if (!selected) throw new Error("No profile available.");
    return selected;
  }, [profileId]);

  useEffect(() => {
    void (async () => {
      await initStorage();
      if (!barcode) return;
      const cached = await getProduct(barcode);
      if (cached) {
        setProduct(cached);
        setOcrText(cached.ocrText ?? "");
      }
    })();
  }, [barcode]);

  async function captureLabel() {
    setMessage("");
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage("Camera permission is required for label OCR.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setProcessing(true);
    const ocr = await recognizeIngredientText(result.assets[0].uri);
    setProcessing(false);

    if (!ocr.ok) {
      setMessage(`${ocr.message} You can type the ingredients manually below.`);
      return;
    }

    setOcrText(ocr.text);
    setMessage("OCR text extracted. Review it before analysis.");
  }

  async function analyze() {
    const profile = await loadProfile();
    const now = new Date().toISOString();
    const productBarcode = manualBarcode.trim() || barcode || `ocr-${Date.now()}`;
    const nextProduct: Product = {
      ...(product ?? {
        barcode: productBarcode,
        productName: "Ingredient label scan",
        lookupStatus: "manual",
        source: "ocr",
        fetchedAt: now,
        updatedAt: now
      }),
      barcode: productBarcode,
      ocrText: ocrText.trim(),
      updatedAt: now
    };

    const savedProduct = await saveProduct(nextProduct);
    const scan = analyzeProduct(savedProduct, profile);
    await saveScan(scan);
    router.replace(`/result?id=${encodeURIComponent(scan.id)}`);
  }

  return (
    <Screen title="Scan ingredient label" subtitle="OCR stays on-device in the development build. Review text before using it.">
      <InfoCard title={product?.productName || "Label OCR"}>
        <Text style={[styles.text, { color: colors.muted }]}>
          Photograph the ingredients panel. If OCR misses text, fix it manually before analysis.
        </Text>
        <AppButton
          title="Photograph ingredient label"
          variant="primary"
          icon={<Feather name="camera" size={18} color={colors.primaryText} />}
          onPress={() => void captureLabel()}
        />
      </InfoCard>

      <InfoCard title="Barcode or label ID">
        <TextInput
          value={manualBarcode}
          onChangeText={setManualBarcode}
          placeholder="Optional barcode"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        />
      </InfoCard>

      <InfoCard title="Ingredient text">
        <TextInput
          value={ocrText}
          onChangeText={setOcrText}
          multiline
          placeholder="OCR or manual ingredient text"
          placeholderTextColor={colors.muted}
          style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        />
        <AppButton title="Analyze ingredient text" onPress={() => void analyze()} disabled={!ocrText.trim() || processing} />
      </InfoCard>

      {processing ? (
        <View style={styles.processing}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.text, { color: colors.muted }]}>Running on-device OCR...</Text>
        </View>
      ) : null}
      {message ? <Text style={[styles.text, { color: colors.muted }]}>{message}</Text> : null}
      <AppButton title="Back home" variant="ghost" onPress={() => router.replace("/")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12
  },
  textArea: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 180,
    padding: 12,
    textAlignVertical: "top"
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  },
  processing: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  }
});
