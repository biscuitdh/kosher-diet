import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Generate"
};

export default function OnboardingPage() {
  redirect("/generate");
}
