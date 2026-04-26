"use client";

import { useSearchParams } from "next/navigation";
import { RecipeDetailClient } from "@/components/recipe-detail-client";

export function RecipeQueryDetailClient() {
  const searchParams = useSearchParams();
  return <RecipeDetailClient id={searchParams.get("id") || ""} />;
}
