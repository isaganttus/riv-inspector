import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CliArgError, parseCliArgs } from "../src/cli.js";

describe("parseCliArgs()", () => {
  test("returns help action with exit code 1 when no arguments are provided", () => {
    const parsed = parseCliArgs([]);

    assert.equal(parsed.action, "help");
    assert.equal(parsed.exitCode, 1);
  });

  test("returns help action with exit code 0 for --help", () => {
    const parsed = parseCliArgs(["--help"]);

    assert.equal(parsed.action, "help");
    assert.equal(parsed.exitCode, 0);
  });

  test("returns version action for --version", () => {
    const parsed = parseCliArgs(["--version"]);

    assert.equal(parsed.action, "version");
  });

  test("parses a single file with all single-file options", () => {
    const parsed = parseCliArgs([
      "file.riv",
      "--output",
      "file.md",
      "--web-preview",
      "https://rive.app/community/files/123",
      "--editor-link",
      "https://rive.app/editor/123",
    ]);

    assert.deepEqual(parsed, {
      action: "run",
      inputPaths: ["file.riv"],
      outputPath: "file.md",
      toStdout: false,
      toJson: false,
      toWatch: false,
      webPreview: "https://rive.app/community/files/123",
      editorLink: "https://rive.app/editor/123",
    });
  });

  test("allows --watch with no paths so config can be loaded later", () => {
    const parsed = parseCliArgs(["--watch"]);

    assert.equal(parsed.action, "run");
    assert.deepEqual(parsed.inputPaths, []);
    assert.equal(parsed.toWatch, true);
  });

  test("rejects unknown options explicitly", () => {
    assert.throws(
      () => parseCliArgs(["--definitely-unknown"]),
      (err: unknown) =>
        err instanceof CliArgError &&
        err.message === "Unknown option: --definitely-unknown",
    );
  });

  test("rejects missing option values", () => {
    assert.throws(
      () => parseCliArgs(["file.riv", "--output"]),
      (err: unknown) =>
        err instanceof CliArgError &&
        err.message === "--output requires a value.",
    );
  });

  test("rejects conflicting output modes", () => {
    assert.throws(
      () => parseCliArgs(["file.riv", "--json", "--stdout"]),
      (err: unknown) =>
        err instanceof CliArgError &&
        err.message === "--json and --stdout cannot be used together.",
    );
  });

  test("rejects JSON with --output", () => {
    assert.throws(
      () => parseCliArgs(["file.riv", "--json", "--output", "file.md"]),
      (err: unknown) =>
        err instanceof CliArgError &&
        err.message ===
          "--json writes to stdout - cannot be used with --output.",
    );
  });

  test("rejects single-file options when multiple inputs are provided", () => {
    assert.throws(
      () => parseCliArgs(["a.riv", "b.riv", "--stdout"]),
      (err: unknown) =>
        err instanceof CliArgError &&
        err.message ===
          "--output, --stdout, --web-preview, and --editor-link are only supported for a single .riv file.",
    );
  });
});
