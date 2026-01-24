import * as fs from "fs/promises";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  invalidCmdSummary,
  scanForCommands,
  unknownActionSummary,
  validateCommandFields,
  validateSearchPathIsFile,
  type OperatorCmd,
} from "../electron/operator_cmd";

type TestCase = { name: string; run: () => Promise<void> | void };

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

async function loadRepoFile(relPath: string): Promise<string> {
  const repoRoot = path.resolve(__dirname, "..");
  const filePath = path.join(repoRoot, relPath);
  return fs.readFile(filePath, "utf-8");
}

function expectSingleWarning(input: string, expected: string, label: string) {
  const res = scanForCommands(input);
  assertEqual(res.warnings.length, 1, `${label} warnings`);
  assertEqual(res.warnings[0], expected, `${label} summary`);
}

function validationSummary(cmd: OperatorCmd): string {
  const v = validateCommandFields(cmd);
  if (v.ok) return "OK";
  return invalidCmdSummary(v.code, v.detail);
}

function expectValidation(cmd: OperatorCmd, expected: string, label: string) {
  const summary = validationSummary(cmd);
  assertEqual(summary, expected, label);
}

async function assertSpecCoversErrCodes() {
  const repoRoot = path.resolve(__dirname, "..");
  const specPath = path.join(repoRoot, "assets", "operator_interface_spec.txt");
  const specText = await fs.readFile(specPath, "utf-8");
  const specCodes = new Set(specText.match(/ERR_[A-Z0-9_]+/g) ?? []);

  const codePaths = [
    path.join(repoRoot, "electron", "main.ts"),
    path.join(repoRoot, "electron", "operator_cmd.ts"),
  ];

  const usedCodes = new Set<string>();
  for (const p of codePaths) {
    const text = await fs.readFile(p, "utf-8");
    for (const m of text.matchAll(/ERR_[A-Z0-9_]+/g)) usedCodes.add(m[0]);
  }

  const missing = [...usedCodes].filter((code) => !specCodes.has(code));
  assert(missing.length === 0, `Interface spec missing codes: ${missing.join(", ")}`);
}

async function loadTemplates(): Promise<Record<string, string>> {
  const repoRoot = path.resolve(__dirname, "..");
  const rendererPath = path.join(repoRoot, "renderer", "renderer.js");
  const text = await fs.readFile(rendererPath, "utf-8");

  const blockMatch = text.match(/const TEMPLATES = \{([\s\S]*?)\n\};/);
  if (!blockMatch) throw new Error("TEMPLATES block not found in renderer.js");
  const block = blockMatch[1];

  const templates: Record<string, string> = {};
  const entryRe = /"([^"]+)"\s*:\s*\[([\s\S]*?)\]\.join\("\\n"\)/g;
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(block))) {
    const key = m[1];
    const body = m[2];
    const lines: string[] = [];
    const lineRe = /"((?:[^"\\]|\\.)*)"/g;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(body))) {
      lines.push(JSON.parse(`"${lm[1]}"`));
    }
    templates[key] = lines.join("\n");
  }

  return templates;
}

async function assertTemplatesValid() {
  const templates = await loadTemplates();
  const keys = Object.keys(templates);
  assert(keys.length > 0, "No templates found.");

  for (const [key, text] of Object.entries(templates)) {
    const res = scanForCommands(text);
    assertEqual(res.warnings.length, 0, `Template warnings: ${key}`);
    assertEqual(res.commands.length, 1, `Template commands: ${key}`);
    const cmd = res.commands[0];
    assert(cmd.version !== undefined, `Template missing version: ${key}`);
    assert(!!cmd.id, `Template missing id: ${key}`);
    assert(!!cmd.action, `Template missing action: ${key}`);
  }
}

const tests: TestCase[] = [
  {
    name: "ERR_MARKER_NOT_ALONE",
    run: () => {
      const input = "OPERATOR_CMD extra";
      const expected = invalidCmdSummary(
        "ERR_MARKER_NOT_ALONE",
        "line 'OPERATOR_CMD extra' must be only OPERATOR_CMD"
      );
      expectSingleWarning(input, expected, "ERR_MARKER_NOT_ALONE");
    },
  },
  {
    name: "ERR_MISSING_END_MARKER",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: missing-end-001",
        "action: fs.list",
        "path: .",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_END_MARKER",
        "reached end of text without END_OPERATOR_CMD."
      );
      expectSingleWarning(input, expected, "ERR_MISSING_END_MARKER");
    },
  },
  {
    name: "ERR_NESTED_BLOCK",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: nest-001",
        "action: fs.list",
        "path: .",
        "OPERATOR_CMD",
        "version: 1",
        "id: nest-002",
        "action: fs.list",
        "path: .",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_NESTED_BLOCK",
        "OPERATOR_CMD started before END_OPERATOR_CMD."
      );
      expectSingleWarning(input, expected, "ERR_NESTED_BLOCK");
    },
  },
  {
    name: "ERR_NON_KEY_VALUE_LINE",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: badline-001",
        "action: fs.list",
        "path: .",
        "not a pair",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_NON_KEY_VALUE_LINE",
        "line 'not a pair' is not key: value."
      );
      expectSingleWarning(input, expected, "ERR_NON_KEY_VALUE_LINE");
    },
  },
  {
    name: "ERR_EMPTY_LINE_IN_CMD",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: empty-001",
        "",
        "action: fs.list",
        "path: .",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_EMPTY_LINE_IN_CMD",
        "empty line inside OPERATOR_CMD."
      );
      expectSingleWarning(input, expected, "ERR_EMPTY_LINE_IN_CMD");
    },
  },
  {
    name: "ERR_NON_ASCII_IN_CMD",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: caf\u00e9",
        "action: fs.list",
        "path: .",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_NON_ASCII_IN_CMD",
        "non-ASCII character detected in command block."
      );
      expectSingleWarning(input, expected, "ERR_NON_ASCII_IN_CMD");
    },
  },
  {
    name: "ERR_CONTENT_HAS_NEWLINES",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "content-001",
        action: "fs.write",
        path: "notes.txt",
        content: "line1\nline2",
      };
      const expected = invalidCmdSummary(
        "ERR_CONTENT_HAS_NEWLINES",
        "content contains newline; use content_b64."
      );
      expectValidation(cmd, expected, "ERR_CONTENT_HAS_NEWLINES");
    },
  },
  {
    name: "ERR_MISSING_WRITE_CONTENT",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "write-missing-001",
        action: "fs.write",
        path: "notes.txt",
      };
      const expected = invalidCmdSummary(
        "ERR_MISSING_WRITE_CONTENT",
        "fs.write requires content or content_b64."
      );
      expectValidation(cmd, expected, "ERR_MISSING_WRITE_CONTENT");
    },
  },
  {
    name: "ERR_MISSING_QUERY (fs.searchTree)",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "searchtree-missing-001",
        action: "fs.searchTree",
        path: "notes.txt",
      };
      const expected = invalidCmdSummary(
        "ERR_MISSING_QUERY",
        "missing query; use query: <text>."
      );
      expectValidation(cmd, expected, "ERR_MISSING_QUERY fs.searchTree");
    },
  },
  {
    name: "ERR_INVALID_BASE64 (content_b64)",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "b64-001",
        action: "fs.write",
        path: "notes.txt",
        content_b64: "not-base64",
      };
      const expected = invalidCmdSummary(
        "ERR_INVALID_BASE64",
        "field=content_b64 is not valid base64."
      );
      expectValidation(cmd, expected, "ERR_INVALID_BASE64 content_b64");
    },
  },
  {
    name: "ERR_INVALID_BASE64 (edits_b64)",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "b64-002",
        action: "fs.applyEdits",
        path: "notes.txt",
        edits_b64: "not-base64",
      };
      const expected = invalidCmdSummary(
        "ERR_INVALID_BASE64",
        "field=edits_b64 is not valid base64."
      );
      expectValidation(cmd, expected, "ERR_INVALID_BASE64 edits_b64");
    },
  },
  {
    name: "ERR_INVALID_BASE64 (patch_b64)",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "b64-003",
        action: "fs.patch",
        path: "notes.txt",
        patch_b64: "not-base64",
      };
      const expected = invalidCmdSummary(
        "ERR_INVALID_BASE64",
        "field=patch_b64 is not valid base64."
      );
      expectValidation(cmd, expected, "ERR_INVALID_BASE64 patch_b64");
    },
  },
  {
    name: "ERR_SEARCH_PATH_IS_DIR",
    run: async () => {
      const dirPath = process.cwd();
      const res = await validateSearchPathIsFile(dirPath);
      if (res.ok) throw new Error("Expected directory check to fail.");
      const expected = invalidCmdSummary(
        "ERR_SEARCH_PATH_IS_DIR",
        "path is a directory; use fs.list."
      );
      assertEqual(res.summary, expected, "ERR_SEARCH_PATH_IS_DIR");
    },
  },
  {
    name: "ERR_ACTION_REQUIRES_PATH",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "needs-path-001",
        action: "fs.list",
      };
      const expected = invalidCmdSummary(
        "ERR_ACTION_REQUIRES_PATH",
        "fs.* actions require path."
      );
      expectValidation(cmd, expected, "ERR_ACTION_REQUIRES_PATH");
    },
  },
  {
    name: "ERR_ACTION_FORBIDS_PATH",
    run: () => {
      const cmd: OperatorCmd = {
        version: 1,
        id: "forbid-path-001",
        action: "operator.getInterfaceSpec",
        path: ".",
      };
      const expected = invalidCmdSummary(
        "ERR_ACTION_FORBIDS_PATH",
        "operator.* actions must not include path."
      );
      expectValidation(cmd, expected, "ERR_ACTION_FORBIDS_PATH");
    },
  },
  {
    name: "ERR_UNKNOWN_ACTION",
    run: () => {
      const expected = invalidCmdSummary(
        "ERR_UNKNOWN_ACTION",
        "Unknown action: fs.nope"
      );
      assertEqual(unknownActionSummary("fs.nope"), expected, "ERR_UNKNOWN_ACTION");
    },
  },
  {
    name: "ERR codes documented in spec",
    run: async () => {
      await assertSpecCoversErrCodes();
    },
  },
  {
    name: "TypeScript build (tsc --noEmit)",
    run: () => {
      const repoRoot = path.resolve(__dirname, "..");
      const tscJs = path.join(repoRoot, "node_modules", "typescript", "lib", "tsc.js");
      const res = spawnSync(process.execPath, [tscJs, "--noEmit"], { cwd: repoRoot, encoding: "utf-8" });
      if (res.error) throw res.error;
      if (res.status !== 0) {
        const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim();
        throw new Error(out || "tsc failed");
      }
    },
  },
  {
    name: "fs.stat + fs.searchTree handlers, no fs.glob",
    run: async () => {
      const text = await loadRepoFile(path.join("electron", "main.ts"));
      const hasFsStatHandler =
        /action\s*===\s*["']fs\.stat["']/.test(text) ||
        /case\s+["']fs\.stat["']/.test(text);
      assert(hasFsStatHandler, "Expected fs.stat action handler in electron/main.ts");

      const hasSearchTree =
        /action\s*===\s*["']fs\.searchTree["']/.test(text) ||
        /case\s+["']fs\.searchTree["']/.test(text);
      assert(hasSearchTree, "Expected fs.searchTree action handler in electron/main.ts");

      const hasGlob = /fs\.glob/.test(text);
      assert(!hasGlob, "Did not expect fs.glob in electron/main.ts");
    },
  },
  {
    name: "Duplicate id warning in operator:scan",
    run: async () => {
      const text = await loadRepoFile(path.join("electron", "main.ts"));
      assert(text.includes("Duplicate command id"), "Expected duplicate-id warning in operator:scan");
    },
  },
  {
    name: "fs.readSlice fallback hint in UI",
    run: async () => {
      const rendererJs = await loadRepoFile(path.join("renderer", "renderer.js"));
      const rendererHtml = await loadRepoFile(path.join("renderer", "index.html"));
      const hasHint = rendererJs.includes("Use fs.readSlice") || rendererHtml.includes("Use fs.readSlice");
      assert(hasHint, "Expected UI hint to use fs.readSlice when fs.read is too large");
    },
  },
  {
    name: "Templates are valid",
    run: async () => {
      await assertTemplatesValid();
    },
  },
];

async function runAll() {
  const failures: string[] = [];
  for (const test of tests) {
    try {
      await test.run();
    } catch (e: any) {
      failures.push(`${test.name}: ${String(e?.message ?? e)}`);
    }
  }

  if (failures.length > 0) {
    console.error("Self-test failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Self-test ok (${tests.length} checks).`);
}

void runAll();
