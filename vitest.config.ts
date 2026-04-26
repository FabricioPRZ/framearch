import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",   // solo llama a runCli()
        "src/cli.ts",     // prompts interactivos, se testean con e2e
        "src/types.ts",   // solo interfaces, sin código ejecutable
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 85,
        statements: 80,
      },
    },
  },
});