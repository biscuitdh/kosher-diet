"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

type GeneratorClientLoaderProps = {
  mode?: "brief" | "matches";
};

const GeneratorClient = dynamic(() => import("@/components/generator-client").then((mod) => mod.GeneratorClient), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />
});

export function GeneratorClientLoader(props: GeneratorClientLoaderProps) {
  return <GeneratorClient {...props} />;
}
