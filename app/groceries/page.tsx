import { Suspense } from "react";
import type { Metadata } from "next";
import { GroceryListClient } from "@/components/grocery-list-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Groceries"
};

export default function GroceriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <GroceryListClient />
    </Suspense>
  );
}
