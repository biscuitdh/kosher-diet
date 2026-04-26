import type { Metadata } from "next";
import { RecipeDetailClient } from "@/components/recipe-detail-client";

export const metadata: Metadata = {
  title: "Recipe"
};

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeDetailClient id={id} />;
}
