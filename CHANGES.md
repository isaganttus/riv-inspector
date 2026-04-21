# What was changed and why

A full record of every improvement made to prepare riv-inspect for open source.

---

## 1. Fixed Node.js version requirement

**File:** `package.json` — `engines` field

**Before:** `"node": ">=18"`
**After:** `"node": ">=22.6.0"`

The `dev` script used `--experimental-strip-types`, which was introduced in Node 22.6.0. Advertising Node 18 support was misleading — anyone on 18–21 would hit a cryptic error immediately on `npm run dev`. The version now matches the actual minimum.

---

## 2. Fixed the TypeScript build pipeline

**Files:** `tsconfig.json`, `src/formatter.ts`, `src/index.ts`, `src/inspector.ts`

The project had no working `tsc` build. Two problems:

**Problem A — Wrong module resolution:** `tsconfig.json` used `moduleResolution: "bundler"`, designed for webpack/Vite, not for a Node.js CLI compiled with `tsc`. Changed to `module: "NodeNext"` and `moduleResolution: "NodeNext"`, the correct setting for a Node ESM package.

**Problem B — `.ts` import extensions:** Source files imported each other as `"./inspector.ts"`. This works with `--experimental-strip-types` at runtime, but `tsc` outputs `.js` files and leaves the import paths unchanged — so `dist/index.js` would try to `import "./inspector.ts"` and crash. Changed all internal imports to `.js` extensions, which TypeScript correctly resolves to `.ts` source files during compilation and emits as valid `.js` references in the output.

**Problem C — Rive callable type:** TypeScript 6 with `NodeNext` resolution types the dynamic `import("@rive-app/canvas-advanced").default` as the full module namespace rather than the callable function, causing a `TS2349` error. Fixed with `(RiveCanvas as any)(...)` at the call site — the narrowest possible escape hatch since this is a runtime WASM bootstrap that is inherently untyped.

---

## 3. Added `@types/node` as a dev dependency

**File:** `package.json`

TypeScript 6 with `NodeNext` does not automatically include Node.js built-in types. Without `@types/node`, every `node:fs`, `node:path`, and `process` reference produced a type error. Added `@types/node` to `devDependencies` and declared `"types": ["node"]` in `tsconfig.json`.

---

## 4. Added `tsx` as a dev dependency

**Files:** `package.json`, `dev` and `test` scripts

`tsx` is a TypeScript runner that handles the `.js`→`.ts` module resolution remapping, allowing `import "./inspector.js"` in source to correctly resolve to `inspector.ts` at dev/test time. Changed the `dev` script from `node --experimental-strip-types src/index.ts` to `tsx src/index.ts`. The test script uses `node --import tsx/esm --test` for the same reason.

Previously, `tsx` and `esbuild` appeared in `node_modules/.bin` from a prior install but were missing from `package.json` and `package-lock.json` — orphaned scripts pointing to packages that no longer existed. They are now properly declared.

---

## 5. Moved `typescript` to `devDependencies`

**File:** `package.json`

`typescript` is a build-time tool. It was incorrectly listed under `dependencies`, meaning every `npm install` of the published package would pull down the full TypeScript compiler (~10 MB) unnecessarily. Moved to `devDependencies`.

---

## 6. Added `files` field to `package.json`

**File:** `package.json`

Without a `files` field, `npm publish` uploads everything: `src/`, `test/`, `node_modules/` contents, config files. Added `"files": ["dist", "README.md", "LICENSE"]` so only the compiled output and essential docs ship to npm.

---

## 7. Added npm package metadata

**File:** `package.json`

Added the fields that matter for npm discoverability and GitHub integration:

- `author` — identifies who maintains the package
- `license` — was already claimed as MIT in the README but not declared in the manifest
- `keywords` — `["rive", "riv", "inspector", "metadata", "cli", "animation"]` — used by the npm registry search
- `repository` — links the npm package back to its GitHub source
- `bugs` — links to the GitHub issues page
- `homepage` — links to the README

> Update `YOUR_USERNAME` in `package.json` with your GitHub username before publishing.

---

## 8. Added `prepublishOnly` script

**File:** `package.json`

Without this, `npm publish` could silently ship stale or missing `dist/` output. `"prepublishOnly": "npm run build"` ensures the project always compiles cleanly before anything is uploaded to the registry.

---

## 9. Added `typecheck` script

**File:** `package.json`

`"typecheck": "tsc --noEmit"` lets you verify types without producing build output. Useful in CI or as a pre-commit check when you don't need to rebuild.

---

## 10. Added `--version` / `-v` flag

**File:** `src/index.ts`

Standard CLI convention. Reads the version from `package.json` at runtime so it stays in sync automatically. Output: `riv-inspect v0.1.0`.

---

## 11. Added `--stdout` / `-s` flag

**File:** `src/index.ts`

Prints the YAML output to stdout instead of writing a file. Makes the tool composable with other CLI tools (`riv-inspect file.riv --stdout | grep artboards`) and significantly easier to use in scripts and CI pipelines. Only valid for a single input file.

---

## 12. Added multi-file support

**File:** `src/index.ts`

The CLI now accepts any number of `.riv` file paths as positional arguments. Each file is processed in sequence and gets its own output file written next to the input. `--output` and `--stdout` are restricted to single-file use and produce a clear error if multiple files are given.

---

## 13. Added integration tests

**Files:** `test/inspector.test.ts`, `test/fixtures/.gitkeep`

Uses Node's built-in `node:test` runner — no extra test framework dependency. Six tests covering:

1. `inspect()` returns a correctly shaped `RivMetadata` object
2. Every artboard has `name`, `size`, `origin`, and `stateMachines`
3. Every view model has `name`, `properties`, and `instances`
4. `format()` produces valid YAML frontmatter with opening and closing `---` markers
5. `format()` includes an `origin` field for every artboard
6. `inspect()` rejects with an `Error` on a non-existent file

Tests 1–5 require a fixture file at `test/fixtures/sample.riv` and skip automatically if it is absent. Test 6 runs unconditionally. The `fixtures/` directory is committed (via `.gitkeep`) but `.riv` files inside it are not — each contributor drops in their own file.

---

## 14. Added `.gitignore`

**File:** `.gitignore`

Excludes `node_modules/`, `dist/`, and generated `*.riv.md` files from version control.

---

## 15. Added `LICENSE` file

**File:** `LICENSE`

The README stated MIT but there was no `LICENSE` file. GitHub and npm both use this file to detect and display the license. Without it, the project appears unlicensed.

> Update the copyright name in `LICENSE` if needed.

---

## 16. Updated README

**File:** `README.md`

- Corrected Node.js version from `>=18` to `>=22.6`
- Added all new CLI flags (`--stdout`, `--version`, multi-file)
- Added a **Development** section with all script commands
- Added a **Contributing** section with steps for first-time contributors
- Removed incorrect mention of `--experimental-strip-types` from usage examples
- Updated project structure to include `test/`
