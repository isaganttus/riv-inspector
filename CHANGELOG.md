# Changelog

## [0.2.0] - 2026-04-22

### Features

- Folder support: positional args can now be directories; all `.riv` files inside are discovered recursively
- `--watch` now works with folders and multiple paths, using per-file debouncing
- `riv-inspector --init-config` creates a `.riv-inspector.json` config file
- `riv-inspector --watch` with no paths reads the config and watches all listed paths
- `--json` one-shot now works with folders (outputs a JSON array)
- `.riv-inspector.json` is gitignored by default

### Notes

- No new runtime dependencies
- `--output`, `--stdout`, `--web-preview`, `--editor-link` remain single-file only; clear errors when misused with folders

---

## [0.1.0] - 2026-04-22

Initial release.

### Features

- Extract artboard, state machine, view model, enum, and asset metadata from `.riv` files
- Output as Markdown with YAML frontmatter alongside the input file by default
- `--output` / `-o` — write output to a custom path
- `--stdout` / `-s` — print Markdown to stdout
- `--json` / `-j` — print JSON to stdout; supports multiple files (outputs array)
- `--watch` — re-inspect on file changes and update output automatically
- `--web-preview` / `-w` — embed a Rive community URL in the frontmatter
- `--editor-link` / `-e` — embed a Rive editor URL in the frontmatter
- Preserves existing comments when re-running on an existing `.md` file
- Multi-file support: `riv-inspector a.riv b.riv c.riv`
- Artboard origin expressed as a normalized 0.0–1.0 value
