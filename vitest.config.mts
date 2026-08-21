import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["tests/e2e/**"],
    setupFiles: ["tests/unit/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.spec.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "happy-dom",
          environment: "happy-dom",
          include: ["tests/unit/**/*.spec.tsx"],
        },
      },
    ],
  },
});
