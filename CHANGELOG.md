# Changelog

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
