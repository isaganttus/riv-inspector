#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  --stdout, -s             Print output to stdout instead of writing a file (single file only)
  --web-preview, -w <url>  Add a webPreview URL to the frontmatter (single file only)
  --editor-link, -e <url>  Add an editorLink URL to the frontmatter (single file only)
  --version, -v            Print version and exit
  --help, -h               Show this help message

Examples:
  riv-inspector animation.riv
  riv-inspector animation.riv -o docs/animation.md
  riv-inspector animation.riv --stdout
  riv-inspector animation.riv --web-preview https://rive.app/community/files/123
  riv-inspector animation.riv --editor-link https://rive.app/editor/123
  riv-inspector a.riv b.riv c.riv
`);
}

function readExistingComments(mdPath: string): string | undefined {
  if (!existsSync(mdPath)) return undefined;
  const content = readFileSync(mdPath, "utf-8");
  const marker = "## Comments";
  const idx = content.indexOf(marker);
  if (idx === -1) return undefined;
  // Return everything after "## Comments" — the newline and any content the user wrote
  return content.slice(idx + marker.length);
}

async function inspectOne(
  rivPath: string,
  outputPath: string | null,
  toStdout: boolean,
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

  const resolvedOutput = outputPath
    ? resolve(outputPath)
    : join(dirname(fullPath), `${basename(fullPath, ".riv")}.md`);

  const metadata = await inspect(fullPath);
  const existingComments = toStdout ? undefined : readExistingComments(resolvedOutput);
  const markdown = format(metadata, { existingComments, webPreview, editorLink });

  if (toStdout) {
    process.stdout.write(markdown);
  } else {
    writeFileSync(resolvedOutput, markdown, "utf-8");
    console.log(`${basename(fullPath)} → ${resolvedOutput}`);
  }
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

  try {
    for (const rivPath of rivPaths) {
      await inspectOne(rivPath, outputPath, toStdout, webPreview, editorLink);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
