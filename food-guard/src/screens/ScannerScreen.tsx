import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { Screen } from "@/components/Screen";
import { FOOD_BARCODE_TYPES, createScanDebouncer, isSupportedFoodBarcode, normalizeBarcode } from "@/services/barcodeScanner";
import { lookupProductByBarcode } from "@/services/openFoodFacts";
import { getProduct, getProfiles, getSelectedProfile, initStorage, saveProduct, saveScan } from "@/services/storage";
import { analyzeProduct } from "@/rules/analyzeProduct";
import { productHasIngredientData, type Product } from "@/types/Product";
import type { Profile } from "@/types/Profile";
import { useTheme } from "@/theme/theme";

export function ScannerScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const debouncer = useRef(createScanDebouncer()).current;
  const [manualBarcode, setManualBarcode] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | undefined>();

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

  async function finish(product: Product) {
    const profile = await loadProfile();
    const savedProduct = await saveProduct(product);
    const scan = analyzeProduct(savedProduct, profile);
    await saveScan(scan);
    router.replace(`/result?id=${encodeURIComponent(scan.id)}`);
  }

  async function lookup(barcodeValue: string) {
    const barcode = normalizeBarcode(barcodeValue);
    if (!isSupportedFoodBarcode(barcode)) {
      setMessage("Unsupported barcode length. Use UPC/EAN with 8, 12, 13, or 14 digits.");
      return;
    }

    setProcessing(true);
    setMessage(`Looking up ${barcode}...`);
    setPendingProduct(undefined);

    try {
      await initStorage();
      const cached = await getProduct(barcode);
      if (cached?.ocrText || cached?.ingredientsText) {
        await finish(cached);
        return;
      }

      const result = await lookupProductByBarcode(barcode, { useMockFallback: true });
      await saveProduct(result.product);

      if (!result.ok) {
        setPendingProduct(result.product);
        setMessage(result.message);
        return;
      }

      if (!productHasIngredientData(result.product)) {
        setPendingProduct(result.product);
        setMessage("Product found, but ingredient data is missing. Scan the ingredient label.");
        return;
      }

      await finish(result.product);
    } finally {
      setProcessing(false);
    }
  }

  function handleBarcodeScanned(event: { data: string }) {
    if (processing || pendingProduct) return;
    if (!debouncer(event.data)) return;
    void lookup(event.data);
  }

  const hasPermission = permission?.granted;

  return (
    <Screen title="Scan barcode" subtitle="UPC/EAN lookup uses Open Food Facts. If ingredients are missing, scan the label next.">
      {!permission ? (
        <ActivityIndicator color={colors.primary} />
      ) : !hasPermission ? (
        <InfoCard title="Camera permission required">
          <Text style={[styles.text, { color: colors.muted }]}>Food Guard needs camera access to scan barcodes.</Text>
          <AppButton title="Grant camera permission" variant="primary" onPress={() => void requestPermission()} />
        </InfoCard>
      ) : (
        <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODE_TYPES] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={[styles.scanHint, { backgroundColor: colors.surface }]}>
            <Feather name="maximize" color={colors.primary} size={22} />
            <Text style={[styles.text, { color: colors.text }]}>Center the barcode in the frame.</Text>
          </View>
        </View>
      )}

      <InfoCard title="Manual barcode">
        <TextInput
          value={manualBarcode}
          onChangeText={setManualBarcode}
          placeholder="Enter UPC/EAN"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        />
        <AppButton title="Look up barcode" onPress={() => void lookup(manualBarcode)} disabled={processing} />
      </InfoCard>

      {processing ? <ActivityIndicator color={colors.primary} /> : null}
      {message ? <Text style={[styles.text, { color: colors.muted }]}>{message}</Text> : null}

      {pendingProduct ? (
        <InfoCard title={pendingProduct.productName || "Ingredient data needed"}>
          <Text style={[styles.text, { color: colors.muted }]}>Unknown — check label manually.</Text>
          <AppButton
            title="Scan ingredient label"
            variant="primary"
            onPress={() => router.replace(`/ocr?barcode=${encodeURIComponent(pendingProduct.barcode)}${profileId ? `&profileId=${encodeURIComponent(profileId)}` : ""}`)}
          />
          <AppButton title="Analyze current data" onPress={() => void finish(pendingProduct)} />
        </InfoCard>
      ) : null}

      <AppButton title="Back home" variant="ghost" onPress={() => router.replace("/")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  scanHint: {
    alignItems: "center",
    bottom: 12,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    left: 12,
    padding: 10,
    position: "absolute",
    right: 12
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 18,
    padding: 12
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  }
});
