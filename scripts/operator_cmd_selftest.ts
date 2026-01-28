import * as fs from "fs/promises";
import * as fsSync from "fs";
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

function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    if (fsSync.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd());
}

function getRepoRoot(): string {
  return findRepoRoot(process.cwd());
}

async function loadRepoFile(relPath: string): Promise<string> {
  const repoRoot = getRepoRoot();
  const filePath = path.join(repoRoot, relPath);
  return fs.readFile(filePath, "utf-8");
}

function expectSingleError(input: string, expected: string, label: string) {
  const res = scanForCommands(input);
  assertEqual(res.errors.length, 1, `${label} errors`);
  assertEqual(res.errors[0], expected, `${label} summary`);
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
  const repoRoot = getRepoRoot();
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
  const repoRoot = getRepoRoot();
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
    assertEqual(res.errors.length, 0, `Template errors: ${key}`);
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
      expectSingleError(input, expected, "ERR_MARKER_NOT_ALONE");
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
      expectSingleError(input, expected, "ERR_MISSING_END_MARKER");
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
      expectSingleError(input, expected, "ERR_NESTED_BLOCK");
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
      expectSingleError(input, expected, "ERR_NON_KEY_VALUE_LINE");
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
      expectSingleError(input, expected, "ERR_EMPTY_LINE_IN_CMD");
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
      expectSingleError(input, expected, "ERR_NON_ASCII_IN_CMD");
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
    name: "ERR_INVALID_BASE64 includes command id",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: badb64-001",
        "action: fs.write",
        "path: test.txt",
        "content_b64: !!!NOT_BASE64!!!",
        "END_OPERATOR_CMD",
      ].join("\n");
      const res = scanForCommands(input);
      assertEqual(res.errors.length, 1, "badb64 errors");
      assert(/id\s*[:=]\s*badb64-001/.test(res.errors[0]), "Expected error summary to include id");
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
    name: "ERR_ACTION_REQUIRES_PATH includes id",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: needs-path-002",
        "action: fs.list",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_ACTION_REQUIRES_PATH",
        "fs.* actions require path. id: needs-path-002"
      );
      expectSingleError(input, expected, "ERR_ACTION_REQUIRES_PATH includes id");
    },
  },
  {
    name: "ERR_MISSING_WRITE_CONTENT includes id",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: write-missing-002",
        "action: fs.write",
        "path: notes.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_WRITE_CONTENT",
        "fs.write requires content or content_b64. id: write-missing-002"
      );
      expectSingleError(input, expected, "ERR_MISSING_WRITE_CONTENT includes id");
    },
  },
  {
    name: "ERR_MISSING_QUERY includes id",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: search-missing-002",
        "action: fs.search",
        "path: notes.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_QUERY",
        "missing query; use query: <text>. id: search-missing-002"
      );
      expectSingleError(input, expected, "ERR_MISSING_QUERY includes id");
    },
  },
  {
    name: "ERR_MISSING_PATH_TO (fs.copy)",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: copy-001",
        "action: fs.copy",
        "path: src/a.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_PATH_TO",
        "path_to is required. id: copy-001"
      );
      expectSingleError(input, expected, "ERR_MISSING_PATH_TO fs.copy");
    },
  },
  {
    name: "ERR_MISSING_PATH_TO (fs.move)",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: move-001",
        "action: fs.move",
        "path: src/a.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_PATH_TO",
        "path_to is required. id: move-001"
      );
      expectSingleError(input, expected, "ERR_MISSING_PATH_TO fs.move");
    },
  },
  {
    name: "ERR_MISSING_PATH_TO (fs.rename)",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: rename-001",
        "action: fs.rename",
        "path: src/a.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_MISSING_PATH_TO",
        "path_to is required. id: rename-001"
      );
      expectSingleError(input, expected, "ERR_MISSING_PATH_TO fs.rename");
    },
  },
  {
    name: "ERR_UNEXPECTED_PATH_TO (fs.read)",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: read-pt-001",
        "action: fs.read",
        "path: notes.txt",
        "path_to: other.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_UNEXPECTED_PATH_TO",
        "path_to is not allowed for this action. id: read-pt-001"
      );
      expectSingleError(input, expected, "ERR_UNEXPECTED_PATH_TO fs.read");
    },
  },
  {
    name: "ERR_UNEXPECTED_PATH_TO (operator.getInterfaceSpec)",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: iface-pt-001",
        "action: operator.getInterfaceSpec",
        "path_to: other.txt",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_UNEXPECTED_PATH_TO",
        "path_to is not allowed for this action. id: iface-pt-001"
      );
      expectSingleError(input, expected, "ERR_UNEXPECTED_PATH_TO operator.getInterfaceSpec");
    },
  },
  {
    name: "Duplicate id with identical content is ignored",
    run: () => {
      const block = [
        "OPERATOR_CMD",
        "version: 1",
        "id: dup-001",
        "action: fs.list",
        "path: .",
        "END_OPERATOR_CMD",
      ].join("\n");
      const input = `${block}\n${block}`;
      const res = scanForCommands(input);
      assertEqual(res.errors.length, 0, "duplicate identical errors");
      assertEqual(res.commands.length, 1, "duplicate identical commands");
    },
  },
  {
    name: "Duplicate id with differing content raises ERR_DUPLICATE_ID",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: dup-002",
        "action: fs.list",
        "path: .",
        "END_OPERATOR_CMD",
        "OPERATOR_CMD",
        "version: 1",
        "id: dup-002",
        "action: fs.readSlice",
        "path: README.md",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_DUPLICATE_ID",
        "duplicate id with differing content: dup-002"
      );
      const res = scanForCommands(input);
      assertEqual(res.commands.length, 1, "duplicate differing commands");
      assertEqual(res.errors.length, 1, "duplicate differing errors");
      assertEqual(res.errors[0], expected, "duplicate differing summary");
    },
  },
  {
    name: "Reject UI-only operator.error in scan",
    run: () => {
      const input = [
        "OPERATOR_CMD",
        "version: 1",
        "id: err-001",
        "action: operator.error",
        "END_OPERATOR_CMD",
      ].join("\n");
      const expected = invalidCmdSummary(
        "ERR_RESERVED_ACTION",
        "action reserved for UI: operator.error"
      );
      const res = scanForCommands(input);
      assertEqual(res.commands.length, 0, "operator.error scan commands");
      assertEqual(res.errors.length, 1, "operator.error scan errors");
      assertEqual(res.errors[0], expected, "operator.error scan summary");
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
    name: "fs.copy/fs.move/fs.rename handlers",
    run: async () => {
      const text = await loadRepoFile(path.join("electron", "main.ts"));
      const hasCopy =
        /action\s*===\s*["']fs\.copy["']/.test(text) ||
        /case\s+["']fs\.copy["']/.test(text);
      const hasMove =
        /action\s*===\s*["']fs\.move["']/.test(text) ||
        /case\s+["']fs\.move["']/.test(text);
      const hasRename =
        /action\s*===\s*["']fs\.rename["']/.test(text) ||
        /case\s+["']fs\.rename["']/.test(text);
      assert(hasCopy, "Expected fs.copy action handler in electron/main.ts");
      assert(hasMove, "Expected fs.move action handler in electron/main.ts");
      assert(hasRename, "Expected fs.rename action handler in electron/main.ts");
    },
  },
  {
    name: "Top bar BrowserView layout uses constants",
    run: async () => {
      const text = await loadRepoFile(path.join("electron", "main.ts"));
      assert(/const\s+TOPBAR_HEIGHT\s*=/.test(text), "Expected TOPBAR_HEIGHT constant in electron/main.ts");
      assert(/const\s+SIDEBAR_WIDTH\s*=/.test(text), "Expected SIDEBAR_WIDTH constant in electron/main.ts");
      assert(/setBounds\(\{\s*x:\s*SIDEBAR_WIDTH,\s*y:\s*TOPBAR_HEIGHT,/.test(text), "Expected chat view bounds offset by TOPBAR_HEIGHT");
    },
  },
  {
    name: "Top bar view HTML exists and includes controls",
    run: async () => {
      const html = await loadRepoFile(path.join("renderer", "topbar.html"));
      assert(html.includes("topbarWorkspace"), "Expected topbarWorkspace element in topbar.html");
      assert(html.includes("llmProfile"), "Expected llmProfile select in topbar.html");
      assert(html.includes("btnGettingStarted"), "Expected btnGettingStarted in topbar.html");
      assert(html.includes("btnWorkspace"), "Expected workspace button in topbar.html");
    },
  },
  {
    name: "Top bar has visible separator from chat",
    run: async () => {
      const html = await loadRepoFile(path.join("renderer", "topbar.html"));
      const hasSeparator =
        /\\.topBar\\s*\\{[\\s\\S]*?border-bottom\\s*:/i.test(html) ||
        /\\.topBar\\s*\\{[\\s\\S]*?box-shadow\\s*:/i.test(html);
      assert(hasSeparator, "Expected .topBar to define border-bottom or box-shadow for visibility");
    },
  },
  {
    name: "Duplicate id error in operator:scan",
    run: async () => {
      const text = await loadRepoFile(path.join("electron", "main.ts"));
      assert(text.includes("Duplicate command id"), "Expected duplicate-id error in operator:scan");
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
    name: "operator.error displayed in UI",
    run: async () => {
      const rendererJs = await loadRepoFile(path.join("renderer", "renderer.js"));
      assert(rendererJs.includes("operator.error"), "Expected UI handling/template for operator.error");
    },
  },
  {
    name: "operator.error result echoes related id",
    run: async () => {
      const rendererJs = await loadRepoFile(path.join("renderer", "renderer.js"));
      const match = rendererJs.match(/async function executeCommand[\s\S]*?const res = await window\.operator\.execute/);
      assert(!!match, "executeCommand block not found");
      const block = match ? match[0] : "";
      assert(block.includes("operator.error"), "operator.error branch missing in executeCommand");
      assert(/JSON\\.parse/.test(block) || /parseJson/.test(block), "Expected executeCommand to parse details_b64 JSON");
      assert(/related_id/.test(block), "Expected executeCommand to read related_id from details_b64");
      assert(/id:\s*\$\{relatedId\}/.test(block), "Expected OPERATOR_RESULT id to use relatedId");
    },
  },
  {
    name: "Sidebar scroll preserved during auto scan",
    run: async () => {
      const rendererJs = await loadRepoFile(path.join("renderer", "renderer.js"));
      const hasSidebarSelector =
        /querySelector\(\s*["']\.sidebar["']/.test(rendererJs) ||
        /getElementById\(\s*["']sidebar["']/.test(rendererJs);
      assert(hasSidebarSelector, "Expected sidebar scroll container selection in renderer.js");

      const hasHelper =
        /function\s+preserveSidebarScroll\s*\(/.test(rendererJs) ||
        /const\s+preserveSidebarScroll\s*=\s*\(/.test(rendererJs);
      assert(hasHelper, "Expected preserveSidebarScroll helper in renderer.js");

      const hasScrollUsage = /scrollTop/.test(rendererJs) && /scrollHeight/.test(rendererJs);
      assert(hasScrollUsage, "Expected scrollTop/scrollHeight usage to preserve sidebar scroll");

      const applyMatch = rendererJs.match(/async function applyScanResults[\s\S]*?\n}/);
      assert(!!applyMatch, "applyScanResults block not found");
      const applyBlock = applyMatch ? applyMatch[0] : "";
      assert(/preserveSidebarScroll\(/.test(applyBlock), "Expected applyScanResults to use preserveSidebarScroll");
    },
  },
  {
    name: "operator.error marks as executed in UI",
    run: async () => {
      const rendererJs = await loadRepoFile(path.join("renderer", "renderer.js"));
      assert(
        rendererJs.includes("operator.error") && rendererJs.includes("executedIds.add"),
        "Expected operator.error execution to be recorded in executedIds"
      );
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
