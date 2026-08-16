import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Options } from "tsup";

// Resolves the `@/*` path alias (see tsconfig.json) to `src/*` for esbuild,
// which does not read tsconfig `paths` on its own. Only prefix-aliases exact
// specifiers starting with "@/" — esbuild's built-in `alias` option only
// matches whole package names, not wildcard prefixes, so this is a small
// custom onResolve plugin instead.
//
// esbuild does not re-run its own extension/index probing on a path returned
// from onResolve — it reads exactly what's returned — so this plugin has to
// do that probing itself (try the bare path, then each extension, then
// index.<ext> for directories) rather than just handing back
// `path.resolve(srcDir, relative)`.
const srcDir = path.resolve(__dirname, "src");
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json"];

function resolveAliasTarget(relative: string): string {
  const base = path.resolve(srcDir, relative);
  for (const ext of RESOLVABLE_EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of RESOLVABLE_EXTENSIONS) {
    const indexPath = path.join(base, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }
  if (existsSync(base)) return base;
  // Nothing matched; return the bare path so esbuild's own error message
  // names the path we attempted, rather than swallowing the failure here.
  return base;
}

const aliasAtPlugin: NonNullable<Options["esbuildPlugins"]>[number] = {
  name: "alias-at-src",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const relative = args.path.slice(2); // strip leading "@/"
      return { path: resolveAliasTarget(relative) };
    });
  },
};

export default defineConfig({
  entry: {
    aygacrm: "src/cli/aygacrm.ts",
    "aygacrm-mcp": "src/mcp/aygacrm-mcp.ts",
  },
  // No "type": "module" in package.json, but both entries use import.meta.url
  // and top-level ESM import/export syntax, so build as ESM and force a
  // ".mjs" extension: that makes plain `node dist/foo.mjs` load them as ESM
  // regardless of the package's default CJS resolution.
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  outDir: "dist",
  target: "node18",
  platform: "node",
  // Runtime dependencies (commander, dotenv, @modelcontextprotocol/sdk,
  // @prisma/client, zod, next, ...) are installed via npm/pnpm alongside the
  // built files, not bundled in. tsup externalizes package.json
  // dependencies/peerDependencies by default — do not flip that off.
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  shims: false,
  // Both source files already start with `#!/usr/bin/env node`; tsup
  // auto-detects that shebang and hoists it to line 1 of the built output on
  // its own, so no `banner` option is needed here (adding one would
  // duplicate the shebang line and produce invalid JS on line 2).
  esbuildPlugins: [aliasAtPlugin],
});
