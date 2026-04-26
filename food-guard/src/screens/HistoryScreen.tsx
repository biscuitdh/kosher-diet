import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { initStorage, listProducts, listScans } from "@/services/storage";
import { useTheme } from "@/theme/theme";
import type { Product } from "@/types/Product";
import type { ScanResult } from "@/types/ScanResult";

type ProductRow = {
  product: Product;
  favorite: boolean;
};

export function HistoryScreen() {
  const { colors } = useTheme();
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await initStorage();
        setScans(await listScans(50));
        setProducts(await listProducts());
      })();
    }, [])
  );

  return (
    <Screen title="History" subtitle="Scan history and locally cached products stay on this device.">
      <InfoCard title="Recent scans">
        {scans.length === 0 ? <Text style={[styles.text, { color: colors.muted }]}>No scan history yet.</Text> : null}
        {scans.map((scan) => (
          <Pressable key={scan.id} style={[styles.row, { borderColor: colors.border }]} onPress={() => router.push(`/result?id=${scan.id}`)}>
            <View style={styles.rowText}>
              <Text style={[styles.product, { color: colors.text }]}>{scan.productName}</Text>
              <Text style={[styles.text, { color: colors.muted }]}>
                {scan.profile.name} • {new Date(scan.createdAt).toLocaleString()}
              </Text>
            </View>
            <StatusBadge status={scan.status} />
          </Pressable>
        ))}
      </InfoCard>

      <InfoCard title="Cached products">
        {products.length === 0 ? <Text style={[styles.text, { color: colors.muted }]}>No cached products.</Text> : null}
        {products.map(({ product, favorite }) => (
          <View key={product.barcode} style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.product, { color: colors.text }]}>{favorite ? "★ " : ""}{product.productName || "Unknown product"}</Text>
              <Text style={[styles.text, { color: colors.muted }]}>{product.brand || product.barcode}</Text>
            </View>
          </View>
        ))}
      </InfoCard>

      <AppButton title="Back home" onPress={() => router.replace("/")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderLeftWidth: 3,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingLeft: 10,
    paddingVertical: 8
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  product: {
    fontSize: 16,
    fontWeight: "800"
  },
  text: {
    fontSize: 14,
    lineHeight: 19
  }
});
