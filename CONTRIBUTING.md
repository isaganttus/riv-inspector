# Contributing

## Development setup

```bash
git clone https://github.com/isaganttus/riv-inspector.git
cd riv-inspector
npm install
```

No build step is needed for development — `npm run dev` runs TypeScript directly via `tsx`.

## Running tests

Tests use Node's built-in `node:test` module. They require a `.riv` test fixture:

```bash
cp your-file.riv test/fixtures/sample.riv
npm test
```

Tests that depend on the fixture are skipped automatically if `sample.riv` is absent.

Type-check without running tests:

```bash
npm run typecheck
```

## Project layout

```
src/
  index.ts       CLI — argument parsing and file I/O
  inspector.ts   Loads the Rive WASM runtime and extracts metadata
  formatter.ts   Serialises RivMetadata to Markdown/YAML
test/
  inspector.test.ts    Integration tests
  fixtures/
    sample.riv         Your test fixture goes here (not committed)
```

## Making changes

- All source is TypeScript with `strict: true`. No `any` except where the WASM API forces it.
- Formatting changes to `formatter.ts` should be covered by a corresponding test.
- If you add a CLI flag, update the `usage()` function, the README options table, and add a test.
- Run `npm run typecheck && npm test` before opening a PR.

## Pull requests

Use the PR template. Keep commits focused — one logical change per commit.
