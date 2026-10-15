import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": src, "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          env: { NEXT_PUBLIC_APP_TIMEZONE: "Asia/Colombo" },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/support/integration-setup.ts"],
          // Files share one database; the npm script passes --no-file-parallelism.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
