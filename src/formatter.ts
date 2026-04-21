import type { RivMetadata, ArtboardMeta, ViewModelMeta, PropertyMeta } from "./inspector.js";

/**
 * Serialize a value for YAML inline format.
 * Arrays become flow-style [a, b, c], strings are quoted if needed.
 */
function yamlArray(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.join(", ")}]`;
}

function yamlPropLine(prop: PropertyMeta): string {
  let line = `{ name: ${prop.name}, type: ${prop.type}`;
  if (prop.enum) line += `, enum: ${prop.enum}`;
  line += " }";
  return line;
}

function buildYamlFrontmatter(meta: RivMetadata): string {
  const lines: string[] = ["---"];

  lines.push(`file: ${meta.file}`);
  if (meta.fileId !== null) lines.push(`fileId: ${meta.fileId}`);
  if (meta.format) lines.push(`format: "${meta.format}"`);

  // Artboards
  if (meta.artboards.length > 0) {
    lines.push("artboards:");
    for (const ab of meta.artboards) {
      lines.push(`  - name: ${ab.name}`);
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
      lines.push(`  - name: ${vm.name}`);
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
      lines.push(`  - name: ${e.name}`);
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

export function format(meta: RivMetadata): string {
  return buildYamlFrontmatter(meta) + "\n";
}
