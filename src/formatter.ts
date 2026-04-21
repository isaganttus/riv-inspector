import type { RivMetadata, ArtboardMeta, ViewModelMeta, PropertyMeta } from "./inspector.js";

/**
 * Quote a YAML scalar value if it contains characters that would break YAML parsing
 * or allow content injection (colons, hashes, brackets, newlines, etc.).
 */
function yamlString(value: string): string {
  // Safe: only word chars, spaces, hyphens, dots, forward slashes, parentheses
  if (/^[\w\s\-\./()]+$/.test(value)) return value;
  // Escape backslashes, double quotes, and control characters, then wrap in double quotes
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/**
 * Serialize a string array as a YAML flow sequence.
 * Each element is individually escaped.
 */
function yamlArray(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map(yamlString).join(", ")}]`;
}

function yamlPropLine(prop: PropertyMeta): string {
  let line = `{ name: ${yamlString(prop.name)}, type: ${yamlString(prop.type)}`;
  if (prop.enum) line += `, enum: ${yamlString(prop.enum)}`;
  line += " }";
  return line;
}

function buildYamlFrontmatter(meta: RivMetadata, webPreview?: string): string {
  const lines: string[] = ["---"];

  lines.push(`file: ${yamlString(meta.file)}`);
  if (webPreview) lines.push(`webPreview: ${yamlString(webPreview)}`);
  if (meta.fileId !== null) lines.push(`fileId: ${meta.fileId}`);
  if (meta.format) lines.push(`format: "${meta.format}"`);

  // Artboards
  if (meta.artboards.length > 0) {
    lines.push("artboards:");
    for (const ab of meta.artboards) {
      lines.push(`  - name: ${yamlString(ab.name)}`);
      lines.push(`    size: ${yamlArray(ab.size.map(String))}`);
      lines.push(`    origin: ${yamlArray(ab.origin.map(String))}`);
      if (ab.stateMachines.length > 0) {
        lines.push(`    stateMachines: ${yamlArray(ab.stateMachines)}`);
      }
    }
  }

  // View Models
  if (meta.viewModels.length > 0) {
    lines.push("viewModels:");
    for (const vm of meta.viewModels) {
      lines.push(`  - name: ${yamlString(vm.name)}`);
      if (vm.properties.length > 0) {
        lines.push("    properties:");
        for (const prop of vm.properties) {
          lines.push(`      - ${yamlPropLine(prop)}`);
        }
      }
      if (vm.instances.length > 0) {
        lines.push(`    instances: ${yamlArray(vm.instances)}`);
      }
    }
  }

  // Enums
  if (meta.enums.length > 0) {
    lines.push("enums:");
    for (const e of meta.enums) {
      lines.push(`  - name: ${yamlString(e.name)}`);
      lines.push(`    values: ${yamlArray(e.values)}`);
    }
  }

  // Assets
  const hasAssets =
    meta.assets.images.length > 0 ||
    meta.assets.fonts.length > 0 ||
    meta.assets.audio.length > 0;

  if (hasAssets) {
    lines.push("assets:");
    if (meta.assets.images.length > 0) {
      lines.push(`  images: ${yamlArray(meta.assets.images)}`);
    }
    if (meta.assets.fonts.length > 0) {
      lines.push(`  fonts: ${yamlArray(meta.assets.fonts)}`);
    }
    if (meta.assets.audio.length > 0) {
      lines.push(`  audio: ${yamlArray(meta.assets.audio)}`);
    }
  }

  lines.push("---");
  return lines.join("\n");
}

export interface FormatOptions {
  existingComments?: string;
  webPreview?: string;
}

export function format(meta: RivMetadata, options?: FormatOptions): string {
  const { existingComments, webPreview } = options ?? {};
  const commentsSection =
    existingComments !== undefined
      ? `## Comments${existingComments}`
      : "## Comments\n";
  return buildYamlFrontmatter(meta, webPreview) + "\n\n" + commentsSection;
}
