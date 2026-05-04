import YAML from "yaml";
import type { PropertyMeta, RivMetadata } from "./inspector.js";

function buildYamlFrontmatter(
  meta: RivMetadata,
  webPreview?: string,
  editorLink?: string,
): string {
  const frontmatter: Record<string, unknown> = {
    file: meta.file,
  };

  if (webPreview) frontmatter.webPreview = webPreview;
  if (editorLink) frontmatter.editorLink = editorLink;
  if (meta.fileId !== null) frontmatter.fileId = meta.fileId;
  if (meta.format) frontmatter.format = meta.format;

  // Artboards
  if (meta.artboards.length > 0) {
    frontmatter.artboards = meta.artboards.map((ab) => ({
      name: ab.name,
      size: ab.size,
      origin: ab.origin,
      ...(ab.stateMachines.length > 0
        ? { stateMachines: ab.stateMachines }
        : {}),
    }));
  }

  // View Models
  if (meta.viewModels.length > 0) {
    frontmatter.viewModels = meta.viewModels.map((vm) => ({
      name: vm.name,
      ...(vm.properties.length > 0
        ? { properties: vm.properties.map((prop) => yamlProperty(prop)) }
        : {}),
      ...(vm.instances.length > 0 ? { instances: vm.instances } : {}),
    }));
  }

  // Enums
  if (meta.enums.length > 0) {
    frontmatter.enums = meta.enums.map((e) => ({
      name: e.name,
      values: e.values,
    }));
  }

  // Assets
  const hasAssets =
    meta.assets.images.length > 0 ||
    meta.assets.fonts.length > 0 ||
    meta.assets.audio.length > 0;

  if (hasAssets) {
    const assets: Partial<RivMetadata["assets"]> = {};
    if (meta.assets.images.length > 0) {
      assets.images = meta.assets.images;
    }
    if (meta.assets.fonts.length > 0) {
      assets.fonts = meta.assets.fonts;
    }
    if (meta.assets.audio.length > 0) {
      assets.audio = meta.assets.audio;
    }
    frontmatter.assets = assets;
  }

  return `---\n${YAML.stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---`;
}

function yamlProperty(prop: PropertyMeta): PropertyMeta {
  return prop.enum
    ? { name: prop.name, type: prop.type, enum: prop.enum }
    : { name: prop.name, type: prop.type };
}

export interface FormatOptions {
  existingComments?: string;
  webPreview?: string;
  editorLink?: string;
}

export function format(meta: RivMetadata, options?: FormatOptions): string {
  const { existingComments, webPreview, editorLink } = options ?? {};
  const commentsSection =
    existingComments !== undefined
      ? `## Comments${existingComments}`
      : "## Comments\n";
  return `${buildYamlFrontmatter(meta, webPreview, editorLink)}\n\n${commentsSection}`;
}
