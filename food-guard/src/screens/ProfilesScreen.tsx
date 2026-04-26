import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { InfoCard } from "@/components/InfoCard";
import { Screen } from "@/components/Screen";
import { createProfile, DEFAULT_KOSHER_CERTIFICATIONS, type AllergyRuleId, type Profile } from "@/types/Profile";
import { deleteProfile, getProfiles, getSelectedProfile, initStorage, saveProfile, selectProfile } from "@/services/storage";
import { useTheme } from "@/theme/theme";

const ALLERGY_CHOICES: Array<{ id: AllergyRuleId; label: string }> = [
  { id: "tomato", label: "Tomato" },
  { id: "nightshades", label: "Nightshades" }
];

export function ProfilesScreen() {
  const { colors } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [draft, setDraft] = useState<Profile | undefined>();

  const load = useCallback(async () => {
    await initStorage();
    const nextProfiles = await getProfiles();
    const selected = await getSelectedProfile();
    setProfiles(nextProfiles);
    setSelectedId(selected?.id);
    setDraft(selected ?? nextProfiles[0]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function updateDraft(patch: Partial<Profile>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  }

  function toggleAllergy(id: AllergyRuleId) {
    if (!draft) return;
    const enabled = draft.allergyRules.includes(id);
    updateDraft({
      allergyRules: enabled ? draft.allergyRules.filter((item) => item !== id) : [...draft.allergyRules, id]
    });
  }

  async function choose(profile: Profile) {
    await selectProfile(profile.id);
    setSelectedId(profile.id);
    setDraft(profile);
  }

  async function save() {
    if (!draft) return;
    const saved = await saveProfile(draft, selectedId === draft.id);
    setDraft(saved);
    await load();
  }

  async function addProfile() {
    const profile = createProfile(`Family member ${profiles.length + 1}`);
    await saveProfile(profile, profiles.length === 0);
    await load();
    setDraft(profile);
  }

  async function removeProfile() {
    if (!draft || profiles.length <= 1) return;
    await deleteProfile(draft.id);
    await load();
  }

  return (
    <Screen title="Profiles" subtitle="Profiles are local only. No allergy rules are uploaded to a custom server.">
      <InfoCard title="Family members">
        <View style={styles.profileList}>
          {profiles.map((profile) => {
            const active = draft?.id === profile.id;
            return (
              <Pressable
                key={profile.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => void choose(profile)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceStrong,
                    borderColor: active ? colors.primary : colors.border
                  }
                ]}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "800" }}>{profile.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton title="Add profile" onPress={() => void addProfile()} />
      </InfoCard>

      {draft ? (
        <>
          <InfoCard title="Profile settings">
            <TextInput
              value={draft.name}
              onChangeText={(name) => updateDraft({ name })}
              placeholder="Profile name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
            />
            <View style={styles.choiceList}>
              {ALLERGY_CHOICES.map((choice) => {
                const enabled = draft.allergyRules.includes(choice.id);
                return (
                  <Pressable
                    key={choice.id}
                    onPress={() => toggleAllergy(choice.id)}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: enabled ? colors.primary : colors.surfaceStrong,
                        borderColor: enabled ? colors.primary : colors.border
                      }
                    ]}
                  >
                    <Text style={{ color: enabled ? colors.primaryText : colors.text, fontWeight: "800" }}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </InfoCard>

          <InfoCard title="Kosher preferences">
            <ToggleRow
              label="Kosher required"
              value={draft.kosher.kosherRequired}
              onValueChange={(value) => updateDraft({ kosher: { ...draft.kosher, kosherRequired: value } })}
            />
            <ToggleRow
              label="Require pareve"
              value={draft.kosher.requirePareve}
              onValueChange={(value) => updateDraft({ kosher: { ...draft.kosher, requirePareve: value } })}
            />
            <ToggleRow
              label="Passover mode"
              value={draft.kosher.passoverMode}
              onValueChange={(value) => updateDraft({ kosher: { ...draft.kosher, passoverMode: value } })}
            />
            <Text style={[styles.text, { color: colors.muted }]}>Accepted certifications, comma-separated</Text>
            <TextInput
              value={draft.kosher.acceptedCertifications.join(", ")}
              onChangeText={(value) =>
                updateDraft({
                  kosher: {
                    ...draft.kosher,
                    acceptedCertifications: value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  }
                })
              }
              placeholder={DEFAULT_KOSHER_CERTIFICATIONS.join(", ")}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
            />
          </InfoCard>

          <View style={styles.actions}>
            <AppButton title="Save profile" variant="primary" onPress={() => void save()} />
            <AppButton title="Use this profile" onPress={() => void selectProfile(draft.id).then(load)} />
            <AppButton title="Delete profile" variant="danger" onPress={() => void removeProfile()} disabled={profiles.length <= 1} />
          </View>
        </>
      ) : null}

      <AppButton title="Back home" variant="ghost" onPress={() => router.replace("/")} />
    </Screen>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  profileList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12
  },
  choiceList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choice: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  actions: {
    gap: 10
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  }
});
