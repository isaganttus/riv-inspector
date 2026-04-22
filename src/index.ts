#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, watch } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { inspect } from "./inspector.js";
import { format } from "./formatter.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function usage() {
  console.log(`
riv-inspector v${version} — Extract metadata from .riv files

Usage:
  riv-inspector <file.riv> [file2.riv ...] [options]

Options:
  --output, -o <path>      Output path for the .md file (single file only)
  --stdout, -s             Print Markdown to stdout instead of writing a file (single file only)
  --json, -j               Print JSON to stdout instead of writing a .md file
  --watch                  Re-inspect on file changes and update output (single file only)
  --web-preview, -w <url>  Add a webPreview URL to the frontmatter (single file only)
  --editor-link, -e <url>  Add an editorLink URL to the frontmatter (single file only)
  --version, -v            Print version and exit
  --help, -h               Show this help message

Examples:
  riv-inspector animation.riv
  riv-inspector animation.riv -o docs/animation.md
  riv-inspector animation.riv --stdout
  riv-inspector animation.riv --json
  riv-inspector animation.riv --json | jq '.artboards'
  riv-inspector animation.riv --watch
  riv-inspector animation.riv --watch --json
  riv-inspector animation.riv --web-preview https://rive.app/community/files/123
  riv-inspector animation.riv --editor-link https://rive.app/editor/123
  riv-inspector a.riv b.riv c.riv
  riv-inspector a.riv b.riv --json
`);
}

function readExistingComments(mdPath: string): string | undefined {
  if (!existsSync(mdPath)) return undefined;
  const content = readFileSync(mdPath, "utf-8");
  const marker = "## Comments";
  const idx = content.indexOf(marker);
  if (idx === -1) return undefined;
  return content.slice(idx + marker.length);
}

async function inspectOne(
  rivPath: string,
  outputPath: string | null,
  toStdout: boolean,
  toJson: boolean,
  webPreview?: string,
  editorLink?: string
): Promise<void> {
  const fullPath = resolve(rivPath);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  if (!fullPath.endsWith(".riv")) {
    throw new Error(`File must have .riv extension: ${fullPath}`);
  }

  const metadata = await inspect(fullPath);

  if (toJson) {
    process.stdout.write(JSON.stringify(metadata, null, 2) + "\n");
    return;
  }

  const resolvedOutput = outputPath
    ? resolve(outputPath)
    : join(dirname(fullPath), `${basename(fullPath, ".riv")}.md`);

  const existingComments = toStdout ? undefined : readExistingComments(resolvedOutput);
  const markdown = format(metadata, { existingComments, webPreview, editorLink });

  if (toStdout) {
    process.stdout.write(markdown);
  } else {
    writeFileSync(resolvedOutput, markdown, "utf-8");
    console.log(`${basename(fullPath)} → ${resolvedOutput}`);
  }
}

async function runWatch(
  rivPath: string,
  outputPath: string | null,
  toStdout: boolean,
  toJson: boolean,
  webPreview?: string,
  editorLink?: string
): Promise<void> {
  const fullPath = resolve(rivPath);

  await inspectOne(rivPath, outputPath, toStdout, toJson, webPreview, editorLink);

  console.error(`Watching ${basename(fullPath)} for changes (Ctrl+C to stop)...`);

  let debounce: ReturnType<typeof setTimeout> | null = null;

  watch(fullPath, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        await inspectOne(rivPath, outputPath, toStdout, toJson, webPreview, editorLink);
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }
    }, 150);
  });

  process.on("SIGINT", () => {
    console.error("\nStopped watching.");
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`riv-inspector v${version}`);
    process.exit(0);
  }

  const rivPaths: string[] = [];
  let outputPath: string | null = null;
  let toStdout = false;
  let toJson = false;
  let toWatch = false;
  let webPreview: string | undefined;
  let editorLink: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        console.error("Error: --output requires a value.");
        process.exit(1);
      }
      outputPath = args[++i];
    } else if (args[i] === "--stdout" || args[i] === "-s") {
      toStdout = true;
    } else if (args[i] === "--json" || args[i] === "-j") {
      toJson = true;
    } else if (args[i] === "--watch") {
      toWatch = true;
    } else if (args[i] === "--web-preview" || args[i] === "-w") {
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        console.error("Error: --web-preview requires a value.");
        process.exit(1);
      }
      webPreview = args[++i];
    } else if (args[i] === "--editor-link" || args[i] === "-e") {
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        console.error("Error: --editor-link requires a value.");
        process.exit(1);
      }
      editorLink = args[++i];
    } else if (!args[i].startsWith("-")) {
      rivPaths.push(args[i]);
    }
  }

  if (rivPaths.length === 0) {
    console.error("Error: No .riv file specified.");
    usage();
    process.exit(1);
  }

  if (toJson && toStdout) {
    console.error("Error: --json and --stdout cannot be used together.");
    process.exit(1);
  }

  if (toJson && outputPath) {
    console.error("Error: --json writes to stdout — cannot be used with --output.");
    process.exit(1);
  }

  if (rivPaths.length > 1 && outputPath) {
    console.error("Error: --output cannot be used with multiple input files.");
    process.exit(1);
  }

  if (rivPaths.length > 1 && toStdout) {
    console.error("Error: --stdout cannot be used with multiple input files.");
    process.exit(1);
  }

  if (rivPaths.length > 1 && webPreview) {
    console.error("Error: --web-preview cannot be used with multiple input files.");
    process.exit(1);
  }

  if (rivPaths.length > 1 && editorLink) {
    console.error("Error: --editor-link cannot be used with multiple input files.");
    process.exit(1);
  }

  if (rivPaths.length > 1 && toWatch) {
    console.error("Error: --watch cannot be used with multiple input files.");
    process.exit(1);
  }

  try {
    if (toWatch) {
      await runWatch(rivPaths[0], outputPath, toStdout, toJson, webPreview, editorLink);
      return;
    }

    if (toJson && rivPaths.length > 1) {
      const results = [];
      for (const rivPath of rivPaths) {
        const fullPath = resolve(rivPath);
        if (!existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
        if (!fullPath.endsWith(".riv")) throw new Error(`File must have .riv extension: ${fullPath}`);
        results.push(await inspect(fullPath));
      }
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
      return;
    }

    for (const rivPath of rivPaths) {
      await inspectOne(rivPath, outputPath, toStdout, toJson, webPreview, editorLink);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
