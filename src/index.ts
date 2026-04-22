#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, watch, statSync, readdirSync } from "node:fs";
import type { FSWatcher } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { inspect } from "./inspector.js";
import { format } from "./formatter.js";
import { loadConfig, CONFIG_FILENAME } from "./config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function usage() {
  console.log(`
riv-inspector v${version} — Extract metadata from .riv files

Usage:
  riv-inspector <file.riv|dir> [file2.riv|dir2 ...] [options]
  riv-inspector --watch                     (uses ${CONFIG_FILENAME})

Options:
  --output, -o <path>      Output path for the .md file (single file only)
  --stdout, -s             Print Markdown to stdout (single file only)
  --json, -j               Print JSON to stdout
  --watch                  Re-inspect on file/folder changes; use config if no paths given
  --init-config            Create a starter ${CONFIG_FILENAME} in the current directory
  --web-preview, -w <url>  Add a webPreview URL to the frontmatter (single file only)
  --editor-link, -e <url>  Add an editorLink URL to the frontmatter (single file only)
  --version, -v            Print version and exit
  --help, -h               Show this help message

Examples:
  riv-inspector animation.riv
  riv-inspector animation.riv --json | jq '.artboards'
  riv-inspector animation.riv --watch
  riv-inspector ./assets/                   inspect all .riv files in a folder
  riv-inspector ./assets/ --watch           watch a folder for changes
  riv-inspector --init-config               create ${CONFIG_FILENAME}
  riv-inspector --watch                     watch paths defined in ${CONFIG_FILENAME}
`);
}

function isDirectory(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function collectRivFiles(inputPath: string): string[] {
  const absPath = resolve(inputPath);
  if (!existsSync(absPath)) throw new Error(`Path not found: ${absPath}`);

  if (!isDirectory(absPath)) {
    if (!absPath.endsWith(".riv")) throw new Error(`Not a .riv file or directory: ${absPath}`);
    return [absPath];
  }

  const entries = readdirSync(absPath, { recursive: true, encoding: "utf-8" }) as string[];
  return entries
    .filter((e) => e.endsWith(".riv"))
    .map((e) => join(absPath, e))
    .sort();
}

function collectAllRivFiles(inputs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const input of inputs) {
    for (const p of collectRivFiles(input)) {
      if (!seen.has(p)) { seen.add(p); result.push(p); }
    }
  }
  return result;
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

  if (!existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  if (!fullPath.endsWith(".riv")) throw new Error(`File must have .riv extension: ${fullPath}`);

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

async function inspectSilent(rivPath: string): Promise<void> {
  try {
    await inspectOne(rivPath, null, false, false);
  } catch (err) {
    console.error(`[error] ${basename(rivPath)}:`, err instanceof Error ? err.message : err);
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

  const watcher = watch(fullPath, () => {
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
    watcher.close();
    console.error("\nStopped watching.");
    process.exit(0);
  });
}

async function runWatchMulti(watchPaths: string[]): Promise<void> {
  // Resolve all .riv files from the given paths and do an initial inspection pass
  const initialFiles = collectAllRivFiles(watchPaths);
  if (initialFiles.length === 0) {
    console.error("No .riv files found in specified paths. Watching for new files...");
  } else {
    for (const f of initialFiles) await inspectSilent(f);
  }

  // Determine unique watch roots: files → watch their parent dir; dirs → watch directly
  const watchRoots = new Set<string>();
  for (const p of watchPaths) {
    const abs = resolve(p);
    watchRoots.add(isDirectory(abs) ? abs : dirname(abs));
  }

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers: FSWatcher[] = [];

  for (const root of watchRoots) {
    const isRoot = isDirectory(root);
    const w = watch(root, { recursive: isRoot }, (_event, filename) => {
      if (typeof filename !== "string") return;
      if (!filename.endsWith(".riv")) return;

      const fullPath = join(root, filename);

      const existing = timers.get(fullPath);
      if (existing) clearTimeout(existing);

      timers.set(fullPath, setTimeout(async () => {
        timers.delete(fullPath);
        if (!existsSync(fullPath)) {
          console.error(`[removed] ${basename(fullPath)}`);
          return;
        }
        await inspectSilent(fullPath);
      }, 150));
    });
    watchers.push(w);
  }

  console.error(
    `Watching ${watchRoots.size} path(s) for .riv changes (Ctrl+C to stop)...`
  );

  process.on("SIGINT", () => {
    for (const w of watchers) w.close();
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

  // --init-config: create starter config and exit
  if (args.includes("--init-config")) {
    const configPath = resolve(process.cwd(), CONFIG_FILENAME);
    if (existsSync(configPath)) {
      console.error(`Error: ${CONFIG_FILENAME} already exists at ${configPath}`);
      process.exit(1);
    }
    writeFileSync(configPath, JSON.stringify({ watch: ["./"] }, null, 2) + "\n", "utf-8");
    console.log(`Created ${configPath}`);
    console.log(`Edit the "watch" array to list the files or folders to watch.`);
    process.exit(0);
  }

  const inputPaths: string[] = [];
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
      inputPaths.push(args[i]);
    }
  }

  // --watch with no paths: load config
  if (inputPaths.length === 0 && toWatch) {
    const config = loadConfig(process.cwd());
    if (!config) {
      console.error(
        `Error: No paths specified and no ${CONFIG_FILENAME} found.\n` +
        `       Run \`riv-inspector --init-config\` to create a starter config.`
      );
      process.exit(1);
    }
    if (config.watch.length === 0) {
      console.error(`Error: ${CONFIG_FILENAME} "watch" array is empty.`);
      process.exit(1);
    }
    await runWatchMulti(config.watch.map((p) => resolve(process.cwd(), p)));
    return;
  }

  if (inputPaths.length === 0) {
    console.error("Error: No .riv file or directory specified.");
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

  const hasDir = inputPaths.some((p) => isDirectory(resolve(p)));

  if (hasDir && (outputPath || toStdout || webPreview || editorLink)) {
    console.error(
      "Error: --output, --stdout, --web-preview, and --editor-link are not supported for directories."
    );
    process.exit(1);
  }

  if (hasDir && toJson && toWatch) {
    console.error("Error: --json + --watch is not supported for directories.");
    process.exit(1);
  }

  // Single .riv file: full flag support including --output, --stdout, --web-preview, --editor-link
  const isSingleFile = inputPaths.length === 1 && !hasDir;

  if (!isSingleFile && (outputPath || toStdout || webPreview || editorLink)) {
    console.error(
      "Error: --output, --stdout, --web-preview, and --editor-link are only supported for a single .riv file."
    );
    process.exit(1);
  }

  try {
    // Single .riv file watch: full flag support
    if (toWatch && isSingleFile) {
      await runWatch(inputPaths[0], outputPath, toStdout, toJson, webPreview, editorLink);
      return;
    }

    // Multi-path or directory watch
    if (toWatch) {
      await runWatchMulti(inputPaths);
      return;
    }

    // One-shot JSON
    if (toJson) {
      const files = collectAllRivFiles(inputPaths);
      if (files.length === 0) { console.error("Error: No .riv files found."); process.exit(1); }
      if (files.length === 1) {
        await inspectOne(files[0], null, false, true);
        return;
      }
      const results = [];
      for (const f of files) results.push(await inspect(resolve(f)));
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
      return;
    }

    // One-shot: files and/or directories
    const files = collectAllRivFiles(inputPaths);
    if (files.length === 0) { console.error("Error: No .riv files found."); process.exit(1); }
    if (outputPath && files.length > 1) {
      console.error("Error: --output cannot be used when multiple .riv files are resolved.");
      process.exit(1);
    }
    for (const f of files) {
      await inspectOne(f, outputPath, toStdout, toJson, webPreview, editorLink);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
