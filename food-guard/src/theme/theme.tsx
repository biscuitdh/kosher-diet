import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { darkColors, lightColors } from "./colors";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: typeof darkColors;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark"))
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
