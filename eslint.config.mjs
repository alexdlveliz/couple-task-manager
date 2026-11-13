import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.wrangler/**",
      "**/.firebase/**",
      "**/.cache/**",
      "**/.superpowers/**",
      "**/.playwright-mcp/**",
      "**/.worktrees/**",
      "**/worktrees/**",
      ".agents/worktrees/**",
      ".specify/integrations/packages/**",
      ".specify/extensions/*/local-config.*",
      "**/.env*",
      "**/.dev.vars*",
      "**/secrets/**",
      "**/*.{pem,key,p12,pfx,crt}",
      "**/*.min.js",
      "**/*.generated.*",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    extends: [js.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/client/**/*.{js,jsx,ts,tsx}"],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ["src/worker/**/*.{js,ts}"],
    languageOptions: { globals: globals.worker },
  },
  {
    files: [
      "scripts/**/*.{js,mjs,cjs,ts}",
      "tests/**/*.{js,mjs,cjs,ts,tsx}",
      "*.{js,mjs,cjs,ts}",
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
