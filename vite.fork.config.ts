// The core and svelte builds from vite.build.config.ts, without its other frameworks' plugins: a git
// install runs `prepare`, and the Angular plugin fails to load there.
import { defineConfig, type Plugin, type UserConfig } from "vite";
import * as path from "node:path";
import { globSync, cpSync, mkdirSync } from "node:fs";
import pkg from "./package.json" with { type: "json" };

type BuildOptions = NonNullable<UserConfig["build"]>;

const external = (id: string) =>
  [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ].some((d) => id.startsWith(d));

const copySvelte = (dest: string): Plugin => ({
  name: "copy-svelte",
  writeBundle() {
    for (const file of globSync("src/svelte/**/*.svelte")) {
      const out = path.join(dest, path.relative("src/svelte", file));
      mkdirSync(path.dirname(out), { recursive: true });
      cpSync(file, out);
    }
  },
});

export default defineConfig(({ mode }): UserConfig => {
  const shared: BuildOptions = {
    target: "esnext",
    sourcemap: true,
    emptyOutDir: false,
  };
  switch (mode) {
    case "core":
      return {
        build: {
          ...shared,
          outDir: "lib/core",
          lib: {
            entry: "src/core/index.ts",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
          },
          rolldownOptions: { external },
          minify: false,
        },
      };
    case "svelte":
      return {
        build: {
          ...shared,
          outDir: "lib/svelte",
          lib: {
            entry: Object.fromEntries(
              globSync("src/svelte/**/{index,utils}.ts").map((file) => [
                path.relative(
                  "src/svelte",
                  file.slice(0, file.length - path.extname(file).length),
                ),
                file,
              ]),
            ),
            formats: ["es"],
            fileName: (_format: string, entryName: string) => `${entryName}.js`,
          },
          rolldownOptions: {
            external: (id: string) => external(id) || id.endsWith(".svelte"),
          },
          minify: false,
        },
        plugins: [copySvelte("lib/svelte")],
      };
  }
  throw new Error(`unknown fork build mode: ${mode}`);
});
