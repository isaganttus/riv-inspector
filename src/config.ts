import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CONFIG_FILENAME = ".riv-inspector.json";

export interface RivInspectorConfig {
  watch: string[];
}

export function loadConfig(cwd = process.cwd()): RivInspectorConfig | null {
  const configPath = resolve(cwd, CONFIG_FILENAME);
  if (!existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    throw new Error(`${CONFIG_FILENAME}: invalid JSON`);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${CONFIG_FILENAME} must be a JSON object`);
  }

  const obj = raw as Record<string, unknown>;

  if (
    !Array.isArray(obj.watch) ||
    !obj.watch.every((p) => typeof p === "string")
  ) {
    throw new Error(
      `${CONFIG_FILENAME}: "watch" must be an array of path strings`,
    );
  }

  return { watch: obj.watch as string[] };
}
