import type { Metadata } from "next";
import { GeneratorClientLoader } from "@/components/generator-client-loader";

export const metadata: Metadata = {
  title: "Browse Recipes"
};

export default function FindPage() {
  return <GeneratorClientLoader mode="matches" />;
}
