import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Find Recipes"
};

export default function OnboardingPage() {
  redirect("/generate");
}
