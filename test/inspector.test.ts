import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { format } from "../src/formatter.js";
import { createInspector, inspect } from "../src/inspector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "fixtures/sample.riv");
const HAS_FIXTURE = existsSync(FIXTURE);

function parseFrontmatter(output: string): Record<string, unknown> {
  const match = output.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `expected YAML frontmatter in output, got:\n${output}`);
  return YAML.parse(match[1]) as Record<string, unknown>;
}

// Place a .riv file at test/fixtures/sample.riv to run the full suite

describe("with fixture", { skip: !HAS_FIXTURE }, () => {
  // ─── Shape ──────────────────────────────────────────────────────────────────

  test("inspect() returns a RivMetadata object with the correct shape", async () => {
    const meta = await inspect(FIXTURE);

    assert.equal(typeof meta.file, "string");
    assert.ok(
      meta.file.endsWith(".riv"),
      `file name should end with .riv, got: ${meta.file}`,
    );
    assert.ok(Array.isArray(meta.artboards));
    assert.ok(Array.isArray(meta.viewModels));
    assert.ok(Array.isArray(meta.enums));
    assert.equal(typeof meta.assets, "object");
    assert.ok(Array.isArray(meta.assets.images));
    assert.ok(Array.isArray(meta.assets.fonts));
    assert.ok(Array.isArray(meta.assets.audio));
  });

  // ─── Artboards ──────────────────────────────────────────────────────────────

  test("has the expected artboards", async () => {
    const { artboards } = await inspect(FIXTURE);
    const names = artboards.map((a) => a.name);

    assert.ok(
      names.includes("Main"),
      `expected artboard "Main", got: ${names}`,
    );
    assert.ok(
      names.includes("Component: Button"),
      `expected artboard "Component: Button", got: ${names}`,
    );
  });

  test("Main artboard has correct size and origin", async () => {
    const { artboards } = await inspect(FIXTURE);
    const main = artboards.find((a) => a.name === "Main");

    assert.ok(main, "Main artboard should exist");
    assert.deepEqual(main.size, [400, 300]);
    assert.equal(main.size.length, 2);
    assert.equal(typeof main.size[0], "number");
    assert.equal(typeof main.size[1], "number");
    assert.equal(main.origin.length, 2);
    assert.equal(typeof main.origin[0], "number");
    assert.equal(typeof main.origin[1], "number");
  });

  test("Main artboard has a state machine", async () => {
    const { artboards } = await inspect(FIXTURE);
    const main = artboards.find((a) => a.name === "Main");

    assert.ok(main, "Main artboard should exist");
    assert.ok(
      main.stateMachines.length > 0,
      "Main should have at least one state machine",
    );
  });

  test("Component: Button artboard has a state machine", async () => {
    const { artboards } = await inspect(FIXTURE);
    const component = artboards.find((a) => a.name === "Component: Button");

    assert.ok(component, '"Component: Button" artboard should exist');
    assert.ok(
      component.stateMachines.length > 0,
      '"Component: Button" should have at least one state machine',
    );
  });

  // ─── View Models ────────────────────────────────────────────────────────────

  test("has the expected view models", async () => {
    const { viewModels } = await inspect(FIXTURE);
    const names = viewModels.map((v) => v.name);

    assert.ok(
      names.includes("MainViewModel"),
      `expected "MainViewModel", got: ${names}`,
    );
    assert.ok(
      names.includes("IconViewModel"),
      `expected "IconViewModel", got: ${names}`,
    );
  });

  test("MainViewModel has all expected property types", async () => {
    const { viewModels } = await inspect(FIXTURE);
    const vm = viewModels.find((v) => v.name === "MainViewModel");

    assert.ok(vm, "MainViewModel should exist");

    const types = vm.properties.map((p) => p.type);
    assert.ok(types.includes("boolean"), "should have a boolean property");
    assert.ok(types.includes("number"), "should have a number property");
    assert.ok(types.includes("string"), "should have a string property");
    assert.ok(types.includes("color"), "should have a color property");
    assert.ok(types.includes("trigger"), "should have a trigger property");
    assert.ok(types.includes("enum"), "should have an enum property");
  });

  test("MainViewModel enum property references the Status enum", async () => {
    const { viewModels } = await inspect(FIXTURE);
    const vm = viewModels.find((v) => v.name === "MainViewModel");

    assert.ok(vm, "MainViewModel should exist");

    const enumProp = vm.properties.find((p) => p.type === "enum");
    assert.ok(enumProp, "should have an enum property");
    assert.equal(
      enumProp.enum,
      "Status",
      `enum property should reference "Status", got: ${enumProp.enum}`,
    );
  });

  test("MainViewModel has at least one instance", async () => {
    const { viewModels } = await inspect(FIXTURE);
    const vm = viewModels.find((v) => v.name === "MainViewModel");

    assert.ok(vm, "MainViewModel should exist");
    assert.ok(
      vm.instances.length > 0,
      "MainViewModel should have at least one instance",
    );
  });

  test("IconViewModel has boolean and trigger properties", async () => {
    const { viewModels } = await inspect(FIXTURE);
    const vm = viewModels.find((v) => v.name === "IconViewModel");

    assert.ok(vm, "IconViewModel should exist");

    const types = vm.properties.map((p) => p.type);
    assert.ok(
      types.includes("boolean"),
      "IconViewModel should have a boolean property",
    );
    assert.ok(
      types.includes("trigger"),
      "IconViewModel should have a trigger property",
    );
  });

  // ─── Enums ──────────────────────────────────────────────────────────────────

  test("has the Status enum with the correct values", async () => {
    const { enums } = await inspect(FIXTURE);
    const statusEnum = enums.find((e) => e.name === "Status");

    assert.ok(statusEnum, "Status enum should exist");

    const values = statusEnum.values;
    assert.ok(
      values.includes("idle"),
      `expected "idle" in Status values, got: ${values}`,
    );
    assert.ok(
      values.includes("active"),
      `expected "active" in Status values, got: ${values}`,
    );
    assert.ok(
      values.includes("complete"),
      `expected "complete" in Status values, got: ${values}`,
    );
    assert.ok(
      values.includes("error"),
      `expected "error" in Status values, got: ${values}`,
    );
  });

  // ─── Assets ─────────────────────────────────────────────────────────────────

  test("has at least one font asset", async () => {
    const { assets } = await inspect(FIXTURE);
    assert.ok(assets.fonts.length > 0, "should have at least one font asset");
  });

  // ─── YAML output ────────────────────────────────────────────────────────────

  test("format() produces valid YAML frontmatter", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);
    const frontmatter = parseFrontmatter(output);

    assert.ok(
      output.startsWith("---\n"),
      "output should start with YAML frontmatter opener",
    );
    assert.ok(
      output.includes("\n---\n"),
      "output should have a YAML frontmatter closer",
    );
    assert.equal(frontmatter.file, meta.file);
    assert.ok(
      Array.isArray(frontmatter.artboards),
      "output should contain the artboards section",
    );
  });

  test("format() quotes artboard names that contain special YAML characters", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);

    // "Component: Button" contains a colon — must be quoted in YAML output
    assert.ok(
      output.includes(`name: "Component: Button"`),
      `expected quoted name in output, got:\n${output}`,
    );
  });

  test("format() includes origin for every artboard", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);
    const frontmatter = parseFrontmatter(output);

    assert.ok(
      Array.isArray(frontmatter.artboards),
      "output should contain artboards",
    );
    assert.equal(
      frontmatter.artboards.filter((artboard: Record<string, unknown>) =>
        Array.isArray(artboard.origin),
      ).length,
      meta.artboards.length,
      "each artboard should have an origin line",
    );
  });

  test("format() includes the Status enum", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);
    const frontmatter = parseFrontmatter(output);

    assert.ok(
      Array.isArray(frontmatter.enums),
      "output should contain the enums section",
    );
    assert.ok(
      frontmatter.enums.some(
        (dataEnum: Record<string, unknown>) => dataEnum.name === "Status",
      ),
      "output should contain the Status enum name",
    );
  });
});

// ─── Comments preservation ────────────────────────────────────────────────────

test("format() outputs an empty ## Comments section when no existing comments are provided", async () => {
  const meta = await inspect(
    resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/sample.riv"),
  ).catch(() => null);
  if (!meta) return; // skip if no fixture
  const output = format(meta);
  assert.ok(
    output.endsWith("## Comments\n"),
    `expected output to end with empty comments section`,
  );
});

test("format() preserves existing comments when provided", () => {
  const stubMeta = {
    file: "stub.riv",
    fileId: null,
    format: "7.0",
    artboards: [],
    viewModels: [],
    enums: [],
    assets: { images: [], fonts: [], audio: [] },
  };
  const existingComments = "\nUse this on the path. Connect mainColor to DS.\n";
  const output = format(stubMeta, { existingComments });

  assert.ok(
    output.includes("## Comments\nUse this on the path."),
    `expected preserved comment text in output, got:\n${output}`,
  );
});

test("format() includes webPreview in frontmatter after file when provided", () => {
  const stubMeta = {
    file: "stub.riv",
    fileId: null,
    format: "7.0",
    artboards: [],
    viewModels: [],
    enums: [],
    assets: { images: [], fonts: [], audio: [] },
  };
  const output = format(stubMeta, {
    webPreview: "https://rive.app/community/files/123",
  });
  const frontmatter = parseFrontmatter(output);

  assert.equal(frontmatter.webPreview, "https://rive.app/community/files/123");
  // webPreview should appear right after the file line
  const fileIdx = output.indexOf("file:");
  const previewIdx = output.indexOf("webPreview:");
  assert.ok(
    previewIdx > fileIdx,
    "webPreview should appear after file in frontmatter",
  );
});

test("format() quotes YAML-like strings while keeping numeric arrays numeric", () => {
  const stubMeta = {
    file: "true",
    fileId: null,
    format: "1.2",
    artboards: [
      {
        name: "123",
        size: [400, 300] as [number, number],
        origin: [0.5, 0.5] as [number, number],
        stateMachines: ["null"],
      },
    ],
    viewModels: [
      {
        name: "off",
        properties: [{ name: "false", type: "enum", enum: "Status" }],
        instances: ["yes"],
      },
    ],
    enums: [{ name: "Status", values: ["idle", "1.2"] }],
    assets: { images: ["no"], fonts: [], audio: [] },
  };

  const output = format(stubMeta);
  const frontmatter = parseFrontmatter(output);

  assert.equal(frontmatter.file, "true");
  assert.equal(frontmatter.format, "1.2");
  assert.equal(frontmatter.artboards[0].name, "123");
  assert.deepEqual(frontmatter.artboards[0].size, [400, 300]);
  assert.deepEqual(frontmatter.artboards[0].origin, [0.5, 0.5]);
  assert.deepEqual(frontmatter.artboards[0].stateMachines, ["null"]);
  assert.equal(frontmatter.viewModels[0].name, "off");
  assert.deepEqual(frontmatter.viewModels[0].properties[0], {
    name: "false",
    type: "enum",
    enum: "Status",
  });
  assert.deepEqual(frontmatter.viewModels[0].instances, ["yes"]);
  assert.deepEqual(frontmatter.enums[0].values, ["idle", "1.2"]);
  assert.deepEqual(frontmatter.assets.images, ["no"]);
});

test("CLI rejects unknown options explicitly", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", "src/index.ts", "--definitely-unknown"],
    {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option: --definitely-unknown/);
});

// ─── Always runs ──────────────────────────────────────────────────────────────

test("inspect() on a non-existent file rejects with an error", async () => {
  await assert.rejects(
    () => inspect("/tmp/does-not-exist.riv"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

test("createInspector() can inspect multiple files with one session", async (t) => {
  if (!HAS_FIXTURE) return;

  const inspector = await createInspector();
  t.after(() => inspector.close());

  const first = await inspector.inspect(FIXTURE);
  const second = await inspector.inspect(FIXTURE);

  assert.equal(first.file, "sample.riv");
  assert.equal(second.file, "sample.riv");
  assert.deepEqual(
    second.artboards.map((a) => a.name),
    first.artboards.map((a) => a.name),
  );
});
