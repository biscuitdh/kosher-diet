export type AllergyRuleId = "tomato" | "nightshades";

export type KosherPreferences = {
  kosherRequired: boolean;
  acceptedCertifications: string[];
  requirePareve: boolean;
  passoverMode: boolean;
};

export type Profile = {
  id: string;
  name: string;
  allergyRules: AllergyRuleId[];
  kosher: KosherPreferences;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_ALLERGY_RULES: AllergyRuleId[] = ["tomato", "nightshades"];

export const DEFAULT_KOSHER_CERTIFICATIONS = ["OU", "OK", "Star-K", "Kof-K"];

export function createProfile(name = "Family member"): Profile {
  const now = new Date().toISOString();
  return {
    id: `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    allergyRules: [...DEFAULT_ALLERGY_RULES],
    kosher: {
      kosherRequired: false,
      acceptedCertifications: [...DEFAULT_KOSHER_CERTIFICATIONS],
      requirePareve: false,
      passoverMode: false
    },
    createdAt: now,
    updatedAt: now
  };
}
