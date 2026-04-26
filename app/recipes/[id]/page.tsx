import type { Metadata } from "next";
import { RecipeDetailClient } from "@/components/recipe-detail-client";
import { listCatalogRecipes } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Recipe"
};

export const dynamicParams = false;

export function generateStaticParams() {
  return listCatalogRecipes().map((record) => ({ id: record.id }));
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeDetailClient id={id} />;
}
