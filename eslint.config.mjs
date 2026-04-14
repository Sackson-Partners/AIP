import { defineConfig } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Minimal flat-config for Next.js 15 + TypeScript.
 * eslint-config-next@15.x uses legacy config format (incompatible with ESLint flat config).
 * We configure the TypeScript parser + commonly referenced plugins directly.
 */
const eslintConfig = defineConfig([
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "backend/static/**",
      "venv/**",
      "write_files.js",
      "fix_files.js",
      "scripts/**",
      "coverage/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": "off",  // Disabled: @typescript-eslint/no-unused-vars handles TS files (avoids false positives on type-signature params)
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",  // TODO: promote to "error" — ~15 remaining `any` types across 6 files
      "@typescript-eslint/no-unused-vars": "error",
      "react-hooks/exhaustive-deps": "warn",          // TODO: promote to "error" — missing deps in deal-rooms/[id] and users pages
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
]);

export default eslintConfig;
