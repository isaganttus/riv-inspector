#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
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
  --output, -o <path>  Output path for the .md file (single file only)
  --stdout, -s         Print output to stdout instead of writing a file (single file only)
  --version, -v        Print version and exit
  --help, -h           Show this help message

Examples:
  riv-inspector animation.riv
  riv-inspector animation.riv -o docs/animation.md
  riv-inspector animation.riv --stdout
  riv-inspector a.riv b.riv c.riv
`);
}

async function inspectOne(
  rivPath: string,
  outputPath: string | null,
  toStdout: boolean
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
    : join(dirname(fullPath), `${basename(fullPath)}.md`);

  const metadata = await inspect(fullPath);
  const markdown = format(metadata);

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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputPath = args[++i];
    } else if (args[i] === "--stdout" || args[i] === "-s") {
      toStdout = true;
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

  try {
    for (const rivPath of rivPaths) {
      await inspectOne(rivPath, outputPath, toStdout);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
