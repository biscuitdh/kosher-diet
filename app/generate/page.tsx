import type { Metadata } from "next";
import { GeneratorClientLoader } from "@/components/generator-client-loader";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    absolute: APP_NAME
  }
};

export default function GeneratePage() {
  return <GeneratorClientLoader />;
}
