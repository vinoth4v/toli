import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Next resolves `@/` from tsconfig paths; vitest does not read those, so
      // without this a test fails the moment it imports a file that uses the
      // alias — which has nothing to do with the code being wrong.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
