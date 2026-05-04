export class CliArgError extends Error {
  readonly exitCode = 1;
}

interface BaseRunArgs {
  action: "run";
  inputPaths: string[];
  outputPath: string | null;
  toStdout: boolean;
  toJson: boolean;
  toWatch: boolean;
  webPreview?: string;
  editorLink?: string;
}

export type ParsedCliArgs =
  | { action: "help"; exitCode: 0 | 1 }
  | { action: "version" }
  | { action: "initConfig" }
  | BaseRunArgs;

function valueAfter(args: string[], index: number, flag: string): string {
  if (index + 1 >= args.length || args[index + 1].startsWith("-")) {
    throw new CliArgError(`${flag} requires a value.`);
  }
  return args[index + 1];
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  if (args.length === 0) return { action: "help", exitCode: 1 };
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help", exitCode: 0 };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }
  if (args.includes("--init-config")) {
    return { action: "initConfig" };
  }

  const inputPaths: string[] = [];
  let outputPath: string | null = null;
  let toStdout = false;
  let toJson = false;
  let toWatch = false;
  let webPreview: string | undefined;
  let editorLink: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output" || arg === "-o") {
      outputPath = valueAfter(args, i, "--output");
      i++;
    } else if (arg === "--stdout" || arg === "-s") {
      toStdout = true;
    } else if (arg === "--json" || arg === "-j") {
      toJson = true;
    } else if (arg === "--watch") {
      toWatch = true;
    } else if (arg === "--web-preview" || arg === "-w") {
      webPreview = valueAfter(args, i, "--web-preview");
      i++;
    } else if (arg === "--editor-link" || arg === "-e") {
      editorLink = valueAfter(args, i, "--editor-link");
      i++;
    } else if (arg.startsWith("-")) {
      throw new CliArgError(`Unknown option: ${arg}`);
    } else {
      inputPaths.push(arg);
    }
  }

  if (inputPaths.length === 0 && !toWatch) {
    throw new CliArgError("No .riv file or directory specified.");
  }
  if (toJson && toStdout) {
    throw new CliArgError("--json and --stdout cannot be used together.");
  }
  if (toJson && outputPath) {
    throw new CliArgError(
      "--json writes to stdout - cannot be used with --output.",
    );
  }

  const hasSingleFileOption =
    outputPath || toStdout || webPreview || editorLink;
  if (inputPaths.length > 1 && hasSingleFileOption) {
    throw new CliArgError(
      "--output, --stdout, --web-preview, and --editor-link are only supported for a single .riv file.",
    );
  }

  return {
    action: "run",
    inputPaths,
    outputPath,
    toStdout,
    toJson,
    toWatch,
    webPreview,
    editorLink,
  };
}
