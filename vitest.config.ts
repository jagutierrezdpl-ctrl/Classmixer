import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  // tsconfig usa jsx: "preserve" (lo transforma Next); para probar páginas .tsx hay que transformarlo aquí
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/algorithm/**", "src/lib/excel/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
