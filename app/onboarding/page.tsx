import type { Metadata } from "next";
import { OnboardingRedirectClient } from "@/components/onboarding-redirect-client";

export const metadata: Metadata = {
  title: "Find Recipes"
};

export default function OnboardingPage() {
  return <OnboardingRedirectClient />;
}
