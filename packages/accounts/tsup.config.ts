import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        "core/index": "src/core/index.ts",
        "nextjs/index": "src/nextjs/index.ts",
        "react/index": "src/react/index.ts",
        "server/index": "src/server/index.ts",
        "webhooks/index": "src/webhooks/index.ts",
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
});
