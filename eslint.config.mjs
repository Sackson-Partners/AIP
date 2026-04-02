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
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
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
      "no-unused-vars": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
