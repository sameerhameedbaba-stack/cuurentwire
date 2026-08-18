import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // Patterns are **-prefixed so generated output is ignored wherever it sits,
  // not just at the repo root: agent git worktrees under .claude/worktrees/
  // carry their own .next/ build output, which otherwise floods `eslint .`
  // with thousands of errors from machine-generated chunks and makes the
  // pre-push lint gate useless.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
  ]),
]);

export default eslintConfig;
