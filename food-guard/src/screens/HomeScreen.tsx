import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/theme/theme";
import type { Profile } from "@/types/Profile";
import type { ScanResult } from "@/types/ScanResult";
import { getProfiles, getSelectedProfile, initStorage, listScans, selectProfile } from "@/services/storage";

export function HomeScreen() {
  const { colors, mode, toggleMode } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | undefined>();
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    await initStorage();
    const nextProfiles = await getProfiles();
    const selected = await getSelectedProfile();
    setProfiles(nextProfiles);
    setSelectedProfile(selected);
    setRecentScans(await listScans(3));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function chooseProfile(profile: Profile) {
    await selectProfile(profile.id);
    setSelectedProfile(profile);
  }

  return (
    <Screen
      title="Food Guard"
      subtitle="Conservative barcode and ingredient checks for tomatoes, nightshades, and optional kosher indicators."
      rightAction={<AppButton title={mode === "dark" ? "Light" : "Dark"} variant="ghost" onPress={toggleMode} />}
    >
      <InfoCard title="Family profile">
        {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Loading local profiles...</Text> : null}
        <View style={styles.profileList}>
          {profiles.map((profile) => {
            const selected = selectedProfile?.id === profile.id;
            return (
              <Pressable
                key={profile.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void chooseProfile(profile)}
                style={[
                  styles.profilePill,
                  {
                    backgroundColor: selected ? colors.primary : colors.surfaceStrong,
                    borderColor: selected ? colors.primary : colors.border
                  }
                ]}
              >
                <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "800" }}>{profile.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton title="Manage profiles" icon={<Feather name="users" size={18} color={colors.text} />} onPress={() => router.push("/profiles")} />
      </InfoCard>

      <View style={styles.actions}>
        <AppButton
          title="Scan barcode"
          variant="primary"
          icon={<Feather name="maximize" size={20} color={colors.primaryText} />}
          onPress={() =>
            router.push({
              pathname: "/scan",
              params: selectedProfile ? { profileId: selectedProfile.id } : {}
            })
          }
          disabled={!selectedProfile}
        />
        <AppButton
          title="Scan ingredient label"
          icon={<Feather name="camera" size={20} color={colors.text} />}
          onPress={() =>
            router.push({
              pathname: "/ocr",
              params: selectedProfile ? { profileId: selectedProfile.id } : {}
            })
          }
          disabled={!selectedProfile}
        />
        <AppButton title="View history" icon={<Feather name="clock" size={20} color={colors.text} />} onPress={() => router.push("/history")} />
      </View>

      <InfoCard title="Recent scans">
        {recentScans.length === 0 ? <Text style={[styles.muted, { color: colors.muted }]}>No scans yet.</Text> : null}
        {recentScans.map((scan) => (
          <Pressable key={scan.id} style={styles.recentRow} onPress={() => router.push(`/result?id=${scan.id}`)}>
            <View style={styles.recentText}>
              <Text style={[styles.product, { color: colors.text }]}>{scan.productName}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{scan.profile.name}</Text>
            </View>
            <StatusBadge status={scan.status} />
          </Pressable>
        ))}
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12
  },
  profileList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  profilePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  recentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  recentText: {
    flex: 1,
    gap: 4
  },
  product: {
    fontSize: 16,
    fontWeight: "800"
  },
  muted: {
    fontSize: 14
  }
});
