# riv-inspect

Extract metadata from `.riv` files and write it as Markdown with YAML frontmatter.

```
riv-inspect <file.riv> [file2.riv ...] [options]
```

---

## What it does

Reads a Rive file without a browser and outputs a `.md` file containing structured YAML describing the file's artboards, state machines, view models, data enums, and assets. Useful for documentation, code generation, or keeping a record of what's inside a `.riv` file.

Example output:

```yaml
---
file: animation.riv
artboards:
  - name: Main
    size: [732, 755]
    origin: [0, 0]
    stateMachines: [sm-main]
  - name: Button
    size: [200, 60]
    origin: [100, 30]
    stateMachines: [State Machine 1]
viewModels:
  - name: Main
    properties:
      - { name: isValid, type: boolean }
      - { name: states, type: enum, enum: States }
    instances: [Instance]
enums:
  - name: States
    values: [idle, active, done]
assets:
  images: [avatar.png]
  fonts: [Inter.ttf]
---
```

---

## Requirements

- **Node.js** v22.6 or later

---

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/riv-inspect.git
cd riv-inspect
npm install
```

No manual build step needed for development — `npm run dev` runs the TypeScript source directly.

To install the compiled binary globally:

```bash
npm run build
npm install -g .
```

---

## Usage

```bash
# Inspect a single .riv file — output defaults to <file>.riv.md next to the input
npm run dev -- path/to/file.riv

# Or using the compiled binary
riv-inspect path/to/file.riv

# Specify a custom output path
riv-inspect path/to/file.riv --output path/to/output.md

# Print to stdout instead of writing a file
riv-inspect path/to/file.riv --stdout

# Inspect multiple files at once
riv-inspect a.riv b.riv c.riv

# Print version
riv-inspect --version
```

---

## Options

| Flag | Alias | Description |
|---|---|---|
| `--output <path>` | `-o` | Output path (single file only) |
| `--stdout` | `-s` | Print to stdout instead of writing a file (single file only) |
| `--version` | `-v` | Print version and exit |
| `--help` | `-h` | Show help message |

---

## Output fields

### Artboards

| Field | Description |
|---|---|
| `name` | Artboard name |
| `size` | `[width, height]` in pixels |
| `origin` | `[x, y]` position of the (0,0) anchor within the artboard frame |
| `stateMachines` | Names of all state machines on this artboard |

**Origin notes:** `[0, 0]` means the origin is pinned to the top-left corner (Rive's default "Frame Origin" mode). A value like `[366, 377]` means the origin sits at the center of a 732×755 artboard.

### View Models

| Field | Description |
|---|---|
| `name` | View model name |
| `properties` | List of `{ name, type[, enum] }` entries |
| `instances` | Named instances defined in the file |

Property types mirror the Rive `DataType` enum: `boolean`, `number`, `string`, `color`, `trigger`, `enum`, `list`, `viewModel`, `image`, `artboard`.

### Enums

| Field | Description |
|---|---|
| `name` | Enum name |
| `values` | All possible string values |

### Assets

| Field | Description |
|---|---|
| `images` | Embedded or referenced image asset filenames |
| `fonts` | Embedded or referenced font asset filenames |
| `audio` | Embedded or referenced audio asset filenames |

---

## Development

```bash
npm run dev -- file.riv     # Run from source
npm run build               # Compile TypeScript to dist/
npm test                    # Run tests
npm run typecheck           # Type-check without emitting
```

---

## How it works

The WASM runtime from `@rive-app/canvas-advanced` is loaded in Node.js with a minimal browser-global polyfill (no canvas, no WebGL). The `.riv` binary is parsed entirely in memory by the Rive C++ runtime compiled to WASM. No network requests are made.

---

## Project structure

```
src/
  index.ts       CLI entry point — argument parsing and file I/O
  inspector.ts   Loads the Rive WASM runtime and extracts metadata
  formatter.ts   Serialises RivMetadata to Markdown/YAML frontmatter
test/
  inspector.test.ts    Integration tests using node:test
  fixtures/
    sample.riv         Your .riv file goes here (not committed)
```

---

## Contributing

1. Fork and clone the repo
2. `npm install`
3. Make your changes in `src/`
4. `npm test` to verify
5. `npm run typecheck` to check types
6. Open a pull request

---

## License

MIT
