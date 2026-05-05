"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { RecipeProfileProvider } from "@/components/recipe-profile-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <RecipeProfileProvider>{children}</RecipeProfileProvider>
    </NextThemesProvider>
  );
}
