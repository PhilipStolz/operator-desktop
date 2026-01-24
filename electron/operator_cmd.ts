import * as fs from "fs/promises";

export type OperatorCmd = {
  version?: number;
  id?: string;
  action?: string;
  path?: string;
  [k: string]: any;
};

export type OperatorResult = {
  id?: string;
  ok: boolean;
  summary: string;
  details_b64?: string;
};

// --- Command parsing (Plain Text -> OPERATOR_CMD blocks) ---

const START_MARK = "OPERATOR_CMD";
const END_MARK = "END_OPERATOR_CMD";

// Hard limits to prevent "spanning the whole chat"
const MAX_BLOCK_CHARS = 50_000;   // max chars inside a single cmd block
const MAX_BLOCK_LINES = 200;      // max lines inside a single cmd block

const KEY_VALUE_RE = /^([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;

function isMarkerLine(line: string, marker: string): boolean {
  // marker must be alone on its line (allow surrounding whitespace)
  return line.trim() === marker;
}

function isMarkerLineNotAlone(line: string, marker: string): boolean {
  const trimmed = line.trim();
  if (trimmed === marker) return false;
  if (!trimmed.startsWith(marker)) return false;
  return trimmed.slice(marker.length).trim().length > 0;
}

export function invalidCmdSummary(code: string, detail: string): string {
  return `Invalid OPERATOR_CMD (${code}): ${detail}`;
}

export function unknownActionSummary(action?: string): string {
  return invalidCmdSummary("ERR_UNKNOWN_ACTION", `Unknown action: ${action ?? ""}`);
}

function isValidBase64(input: string): boolean {
  const b64 = input.trim();
  if (!b64) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  if (b64.length % 4 !== 0) return false;
  const decoded = Buffer.from(b64, "base64");
  const normalized = (s: string) => s.replace(/=+$/, "");
  return normalized(decoded.toString("base64")) === normalized(b64);
}

function parseKeyValueLines(lines: string[]): OperatorCmd {
  const cmd: OperatorCmd = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Only accept simple key: value lines; ignore anything else
    const m = line.match(KEY_VALUE_RE);
    if (!m) continue;

    const key = m[1];
    let value: any = m[2];

    // Basic typing
    if (key === "version") {
      const n = Number(value);
      if (!Number.isNaN(n)) value = n;
    } else if (value === "true") value = true;
    else if (value === "false") value = false;

    cmd[key] = value;
  }
  return cmd;
}

export function validateCommandFields(cmd: OperatorCmd): { ok: true } | { ok: false; code: string; detail: string } {
  const missing: string[] = [];
  if (cmd.version === undefined) missing.push("version");
  if (!cmd.id) missing.push("id");
  if (!cmd.action) missing.push("action");

  if (missing.length > 0) {
    return {
      ok: false,
      code: "ERR_MISSING_REQUIRED_FIELDS",
      detail: `missing ${missing.join(", ")}`,
    };
  }

  const action = String(cmd.action);
  const pathValue = cmd.path ? String(cmd.path) : "";
  const isFs = action.startsWith("fs.");
  if (isFs && !pathValue) {
    return { ok: false, code: "ERR_ACTION_REQUIRES_PATH", detail: "fs.* actions require path." };
  }
  if (!isFs && pathValue) {
    const detail = action.startsWith("operator.")
      ? "operator.* actions must not include path."
      : "non-fs actions must not include path.";
    return { ok: false, code: "ERR_ACTION_FORBIDS_PATH", detail };
  }

  const versionNum = Number(cmd.version);
  if (!Number.isFinite(versionNum) || versionNum !== 1) {
    return { ok: false, code: "ERR_UNSUPPORTED_VERSION", detail: "version must be 1." };
  }

  if (action === "fs.write") {
    const hasContent = typeof cmd.content === "string";
    const hasContentB64 = typeof cmd.content_b64 === "string";
    if (!hasContent && !hasContentB64) {
      return { ok: false, code: "ERR_MISSING_WRITE_CONTENT", detail: "fs.write requires content or content_b64." };
    }
  }

  if (action === "fs.search" || action === "fs.searchTree") {
    const q1 = typeof (cmd as any).query === "string" ? (cmd as any).query : "";
    const q2 = typeof (cmd as any).q === "string" ? (cmd as any).q : "";
    if (!(q1 || q2).trim()) {
      return { ok: false, code: "ERR_MISSING_QUERY", detail: "missing query; use query: <text>." };
    }
  }

  const linePrefixRaw = typeof (cmd as any).comment_line_prefix === "string" ? String((cmd as any).comment_line_prefix) : "";
  const blockStartRaw = typeof (cmd as any).comment_block_start === "string" ? String((cmd as any).comment_block_start) : "";
  const blockEndRaw = typeof (cmd as any).comment_block_end === "string" ? String((cmd as any).comment_block_end) : "";
  const hasLine = linePrefixRaw.trim().length > 0;
  const hasBlockStart = blockStartRaw.trim().length > 0;
  const hasBlockEnd = blockEndRaw.trim().length > 0;
  if ((hasLine && (hasBlockStart || hasBlockEnd)) || (hasBlockStart && !hasBlockEnd) || (!hasBlockStart && hasBlockEnd)) {
    return {
      ok: false,
      code: "ERR_INVALID_COMMENT_STYLE",
      detail: "Use either comment_line_prefix or comment_block_start/comment_block_end.",
    };
  }
  if (!hasLine && linePrefixRaw && !hasBlockStart && !hasBlockEnd) {
    return {
      ok: false,
      code: "ERR_INVALID_COMMENT_STYLE",
      detail: "comment_line_prefix must be non-empty.",
    };
  }

  if (action === "fs.readRegion" || action === "fs.replaceRegion" || action === "fs.deleteRegion" || action === "fs.insertRegion") {
    const markerId = typeof (cmd as any).marker_id === "string" ? String((cmd as any).marker_id).trim() : "";
    if (!markerId) {
      return { ok: false, code: "ERR_MISSING_MARKER_ID", detail: "marker_id is required." };
    }
    if (action === "fs.replaceRegion" && typeof (cmd as any).content_b64 !== "string") {
      return { ok: false, code: "ERR_MISSING_CONTENT_B64", detail: "content_b64 is required." };
    }
    if (action === "fs.insertRegion") {
      if (typeof (cmd as any).content_b64 !== "string") {
        return { ok: false, code: "ERR_MISSING_CONTENT_B64", detail: "content_b64 is required." };
      }
      const anchor = typeof (cmd as any).anchor === "string" ? String((cmd as any).anchor).trim() : "";
      if (!anchor) {
        return { ok: false, code: "ERR_MISSING_ANCHOR", detail: "anchor is required." };
      }
      const occurrenceRaw = (cmd as any).occurrence;
      if (occurrenceRaw !== undefined && !Number.isFinite(Number(occurrenceRaw))) {
        return { ok: false, code: "ERR_INVALID_ANCHOR_OCCURRENCE", detail: "occurrence must be a number." };
      }
      const posRaw = typeof (cmd as any).position === "string" ? String((cmd as any).position).trim() : "";
      if (posRaw && posRaw !== "before" && posRaw !== "after") {
        return { ok: false, code: "ERR_INVALID_INSERT_POSITION", detail: "position must be 'before' or 'after'." };
      }
    }
  }

  if (action === "fs.readSlice") {
    const startRaw = (cmd as any).start ?? (cmd as any).line ?? (cmd as any).from;
    const linesRaw = (cmd as any).lines ?? (cmd as any).count ?? (cmd as any).len;
    if (startRaw !== undefined && !Number.isFinite(Number(startRaw))) {
      return { ok: false, code: "ERR_INVALID_READSLICE_PARAMS", detail: "start must be a number." };
    }
    if (linesRaw !== undefined && !Number.isFinite(Number(linesRaw))) {
      return { ok: false, code: "ERR_INVALID_READSLICE_PARAMS", detail: "lines must be a number." };
    }
  }

  if (action === "fs.applyEdits" && typeof cmd.edits_b64 !== "string") {
    return { ok: false, code: "ERR_MISSING_EDITS_B64", detail: "edits_b64 is required." };
  }
  if (action === "fs.patch" && typeof cmd.patch_b64 !== "string") {
    return { ok: false, code: "ERR_MISSING_PATCH_B64", detail: "patch_b64 is required." };
  }

  if (typeof cmd.content === "string" && (cmd.content.includes("\n") || cmd.content.includes("\r"))) {
    return { ok: false, code: "ERR_CONTENT_HAS_NEWLINES", detail: "content contains newline; use content_b64." };
  }

  const b64Fields: Array<["content_b64" | "patch_b64" | "edits_b64", string | undefined]> = [
    ["content_b64", cmd.content_b64],
    ["patch_b64", cmd.patch_b64],
    ["edits_b64", cmd.edits_b64],
  ];

  for (const [field, value] of b64Fields) {
    if (value === undefined) continue;
    if (typeof value !== "string" || !isValidBase64(value)) {
      return {
        ok: false,
        code: "ERR_INVALID_BASE64",
        detail: `field=${field} is not valid base64.`,
      };
    }
  }

  return { ok: true };
}

export function scanForCommands(plainText: string): { commands: OperatorCmd[]; errors: string[] } {
  const errors: string[] = [];
  const commands: OperatorCmd[] = [];

  const lines = plainText.split(/\r?\n/g);

  let inBlock = false;
  let buf: string[] = [];
  let bufChars = 0;

  function resetBlock() {
    inBlock = false;
    buf = [];
    bufChars = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock) {
      if (isMarkerLineNotAlone(line, START_MARK)) {
        errors.push(invalidCmdSummary("ERR_MARKER_NOT_ALONE", `line '${line.trim()}' must be only ${START_MARK}`));
        continue;
      }
      if (isMarkerLineNotAlone(line, END_MARK)) {
        errors.push(invalidCmdSummary("ERR_MARKER_NOT_ALONE", `line '${line.trim()}' must be only ${END_MARK}`));
        continue;
      }
      if (isMarkerLine(line, START_MARK)) {
        inBlock = true;
        buf = [];
        bufChars = 0;
      }
      continue;
    }

    // inBlock
    if (isMarkerLineNotAlone(line, END_MARK)) {
      errors.push(invalidCmdSummary("ERR_MARKER_NOT_ALONE", `line '${line.trim()}' must be only ${END_MARK}`));
      resetBlock();
      continue;
    }
    if (isMarkerLineNotAlone(line, START_MARK)) {
      errors.push(invalidCmdSummary("ERR_MARKER_NOT_ALONE", `line '${line.trim()}' must be only ${START_MARK}`));
      resetBlock();
      continue;
    }

    if (isMarkerLine(line, END_MARK)) {
      // finalize block
      const hasNonAscii = buf.some((raw) => NON_ASCII_RE.test(raw));
      if (hasNonAscii) {
        errors.push(invalidCmdSummary("ERR_NON_ASCII_IN_CMD", "non-ASCII character detected in command block."));
        resetBlock();
        continue;
      }

      const invalidLines = buf.filter((raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return false;
        return !KEY_VALUE_RE.test(trimmed);
      });

      if (invalidLines.length > 0) {
        const bad = invalidLines[0].trim();
        errors.push(invalidCmdSummary("ERR_NON_KEY_VALUE_LINE", `line '${bad}' is not key: value.`));
        resetBlock();
        continue;
      }

      const cmd = parseKeyValueLines(buf);

      // Strict required fields to avoid false positives
      const id = cmd.id ? String(cmd.id).trim() : "";
      const action = cmd.action ? String(cmd.action).trim() : "";
      const p = cmd.path ? String(cmd.path).trim() : "";
      const needsPath = action.startsWith("fs.");

      if (!id || !action || cmd.version === undefined) {
        const missing = [
          cmd.version === undefined ? "version" : null,
          !id ? "id" : null,
          !action ? "action" : null,
        ].filter(Boolean).join(", ");
        errors.push(invalidCmdSummary("ERR_MISSING_REQUIRED_FIELDS", `missing ${missing}`));
        resetBlock();
        continue;
      }

      if (needsPath && !p) {
        errors.push(invalidCmdSummary("ERR_ACTION_REQUIRES_PATH", "fs.* actions require path."));
        resetBlock();
        continue;
      }

      if (!needsPath && p) {
        const detail = action.startsWith("operator.")
          ? "operator.* actions must not include path."
          : "non-fs actions must not include path.";
        errors.push(invalidCmdSummary("ERR_ACTION_FORBIDS_PATH", detail));
        resetBlock();
        continue;
      }

      const validation = validateCommandFields(cmd);
      if (!validation.ok) {
        errors.push(invalidCmdSummary(validation.code, validation.detail));
        resetBlock();
        continue;
      }

      // normalize typed fields
      cmd.id = id;
      cmd.action = action;
      if (needsPath) cmd.path = p;

      commands.push(cmd);

      resetBlock();
      continue;
    }

    if (line.trim() === "") {
      errors.push(invalidCmdSummary("ERR_EMPTY_LINE_IN_CMD", "empty line inside OPERATOR_CMD."));
      resetBlock();
      continue;
    }

    // still in block - collect with limits
    buf.push(line);
    bufChars += line.length + 1;

    if (buf.length > MAX_BLOCK_LINES) {
      errors.push(invalidCmdSummary("ERR_BLOCK_TOO_LARGE", `too many lines (>${MAX_BLOCK_LINES}).`));
      resetBlock();
      continue;
    }
    if (bufChars > MAX_BLOCK_CHARS) {
      errors.push(invalidCmdSummary("ERR_BLOCK_TOO_LARGE", `too many characters (>${MAX_BLOCK_CHARS}).`));
      resetBlock();
      continue;
    }

    // If another START appears before END, reset to avoid nesting/spanning
    if (isMarkerLine(line, START_MARK)) {
      errors.push(invalidCmdSummary("ERR_NESTED_BLOCK", "OPERATOR_CMD started before END_OPERATOR_CMD."));
      // treat this line as a new start
      inBlock = true;
      buf = [];
      bufChars = 0;
    }
  }

  if (inBlock) {
    errors.push(invalidCmdSummary("ERR_MISSING_END_MARKER", "reached end of text without END_OPERATOR_CMD."));
  }

  return { commands, errors };
}

export async function validateSearchPathIsFile(
  absPath: string
): Promise<{ ok: true } | { ok: false; summary: string }> {
  const stat = await fs.stat(absPath);
  if (stat.isDirectory()) {
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_SEARCH_PATH_IS_DIR", "path is a directory; use fs.list."),
    };
  }
  return { ok: true };
}
