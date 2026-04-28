import { Suspense } from "react";
import type { Metadata } from "next";
import { GeneratorClient } from "@/components/generator-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Find"
};

export default function GeneratePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <GeneratorClient />
    </Suspense>
  );
}
