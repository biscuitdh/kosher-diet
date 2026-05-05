import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".build-workspaces/**", ".next/**", ".next-dev/**", ".next-export/**", ".next-build-check/**", ".next-firebase-export/**", "out/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "food-guard/**"]
  }
];

export default eslintConfig;
