import { Suspense } from "react";
import type { Metadata } from "next";
import { RecipeQueryDetailClient } from "@/components/recipe-query-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Saved Recipe"
};

export default function LocalRecipePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RecipeQueryDetailClient />
    </Suspense>
  );
}
