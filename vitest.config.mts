import { defineConfig } from "vitest/config";
import { cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    globals: true,
    poolRunner: cloudflarePool({
      wrangler: {
        configPath: "./wrangler.toml",
      },
    }),
  } as any,
}); 