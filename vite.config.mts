import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/monaco-editor")) {
            return "monaco";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
