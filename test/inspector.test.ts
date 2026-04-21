import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "../src/inspector.js";
import { format } from "../src/formatter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "fixtures/sample.riv");
const HAS_FIXTURE = existsSync(FIXTURE);

// To run the full test suite, place any .riv file at test/fixtures/sample.riv

describe("with fixture", { skip: !HAS_FIXTURE }, () => {
  test("inspect() returns a RivMetadata object with the correct shape", async () => {
    const meta = await inspect(FIXTURE);

    assert.equal(typeof meta.file, "string");
    assert.ok(meta.file.endsWith(".riv"), `file name should end with .riv, got: ${meta.file}`);

    assert.ok(Array.isArray(meta.artboards), "artboards should be an array");
    assert.ok(meta.artboards.length > 0, "should have at least one artboard");

    assert.ok(Array.isArray(meta.viewModels), "viewModels should be an array");
    assert.ok(Array.isArray(meta.enums), "enums should be an array");

    assert.equal(typeof meta.assets, "object");
    assert.ok(Array.isArray(meta.assets.images));
    assert.ok(Array.isArray(meta.assets.fonts));
    assert.ok(Array.isArray(meta.assets.audio));
  });

  test("each artboard has name, size, origin, and stateMachines", async () => {
    const meta = await inspect(FIXTURE);

    for (const ab of meta.artboards) {
      assert.equal(typeof ab.name, "string", "artboard name should be a string");
      assert.ok(ab.name.length > 0, "artboard name should not be empty");

      assert.ok(Array.isArray(ab.size), "size should be an array");
      assert.equal(ab.size.length, 2, "size should have exactly 2 elements");
      assert.equal(typeof ab.size[0], "number");
      assert.equal(typeof ab.size[1], "number");

      assert.ok(Array.isArray(ab.origin), "origin should be an array");
      assert.equal(ab.origin.length, 2, "origin should have exactly 2 elements");
      assert.equal(typeof ab.origin[0], "number");
      assert.equal(typeof ab.origin[1], "number");

      assert.ok(Array.isArray(ab.stateMachines), "stateMachines should be an array");
    }
  });

  test("each viewModel has name, properties, and instances", async () => {
    const meta = await inspect(FIXTURE);

    for (const vm of meta.viewModels) {
      assert.equal(typeof vm.name, "string");
      assert.ok(vm.name.length > 0, "viewModel name should not be empty");
      assert.ok(Array.isArray(vm.properties));
      assert.ok(Array.isArray(vm.instances));

      for (const prop of vm.properties) {
        assert.equal(typeof prop.name, "string");
        assert.equal(typeof prop.type, "string");
      }
    }
  });

  test("format() produces valid YAML frontmatter", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);

    assert.ok(output.startsWith("---\n"), "output should start with YAML frontmatter opener");
    assert.ok(output.includes("\n---\n"), "output should contain a YAML frontmatter closer");
    assert.ok(output.includes("file:"), "output should contain the file field");
    assert.ok(output.includes("artboards:"), "output should contain the artboards section");
  });

  test("format() includes origin for every artboard", async () => {
    const meta = await inspect(FIXTURE);
    const output = format(meta);

    const originMatches = output.match(/^\s+origin:/gm);
    assert.ok(originMatches, "output should contain at least one origin field");
    assert.equal(
      originMatches?.length,
      meta.artboards.length,
      "each artboard should have an origin line"
    );
  });
});

test("inspect() on a non-existent file rejects with an error", async () => {
  await assert.rejects(
    () => inspect("/tmp/does-not-exist.riv"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});
