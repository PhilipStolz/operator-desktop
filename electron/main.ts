// electron/main.ts
import {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  ipcMain,
  clipboard,
  dialog,
} from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import type { Event as ElectronEvent } from "electron";

const APP_NAME = "Operator";
const START_URL = process.env.OPERATOR_START_URL ?? "https://chat.openai.com/";

const ALLOWED_HOSTS = new Set([
  "chat.openai.com",
  "chatgpt.com",
  "auth.openai.com",
  "openai.com",
  // optional: "chat.deepseek.com",
]);

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

ipcMain.handle("operator:readClipboard", async () => {
  const text = clipboard.readText() ?? "";
  const limited = text.length > 2_000_000 ? text.slice(0, 2_000_000) : text; // DoS guard
  return { text: limited };
});


function getAssetPath(...segments: string[]) {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(base, "assets", ...segments);
}

function applyBranding(win: BrowserWindow) {
  win.setTitle(APP_NAME);
  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle(APP_NAME);
  });
}

function hardenWebContents(wc: Electron.WebContents) {
  // Popups / window.open -> extern öffnen
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Navigation kontrollieren
  wc.on("will-navigate", (event: ElectronEvent, url: string) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) {
        shell.openExternal(url);
      }
    }
  });

  // Redirects absichern
  wc.on("will-redirect", (event: ElectronEvent, url: string) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) {
        shell.openExternal(url);
      }
    }
  });
}

type OperatorCmd = {
  version?: number;
  id?: string;
  action?: string;
  path?: string;
  [k: string]: any;
};

type OperatorResult = {
  id?: string;
  ok: boolean;
  summary: string;
  details_b64?: string;
};

type ApplyEdit =
  | {
    op: "insertAfter" | "insertBefore";
    anchor: string;
    occurrence?: number;
    text: string;
  }
  | {
    op: "replaceFirst" | "replaceAll";
    find: string;
    text: string;
  }
  | {
    op: "replaceRange";
    startLine: number;
    endLine: number;
    text: string;
  };

type ApplyEditsPayload = {
  version: number;
  strict: boolean;
  edits: ApplyEdit[];
};


function b64(s: string) {
  return Buffer.from(s, "utf-8").toString("base64");
}

async function readInterfaceSpec(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const specPath = getAssetPath("operator_interface_spec.txt");
    const text = await fs.readFile(specPath, "utf-8");
    const limited = text.length > 200_000 ? text.slice(0, 200_000) : text;
    return { ok: true, text: limited };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}


// --- Command parsing (Plain Text -> OPERATOR_CMD blocks) ---

const START_MARK = "OPERATOR_CMD";
const END_MARK = "END_OPERATOR_CMD";

// Hard limits to prevent "spanning the whole chat"
const MAX_BLOCK_CHARS = 50_000;   // max chars inside a single cmd block
const MAX_BLOCK_LINES = 200;      // max lines inside a single cmd block

function isMarkerLine(line: string, marker: string): boolean {
  // marker must be alone on its line (allow surrounding whitespace)
  return line.trim() === marker;
}

function parseKeyValueLines(lines: string[]): OperatorCmd {
  const cmd: OperatorCmd = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Only accept simple key: value lines; ignore anything else
    const m = line.match(/^([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/);
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

function scanForCommands(plainText: string): { commands: OperatorCmd[]; warnings: string[] } {
  const warnings: string[] = [];
  const commands: OperatorCmd[] = [];

  const lines = plainText.split(/\r?\n/g);

  let inBlock = false;
  let buf: string[] = [];
  let bufChars = 0;

  function resetBlock(reason?: string) {
    inBlock = false;
    buf = [];
    bufChars = 0;
    if (reason) warnings.push(reason);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock) {
      if (isMarkerLine(line, START_MARK)) {
        inBlock = true;
        buf = [];
        bufChars = 0;
      }
      continue;
    }

    // inBlock
    if (isMarkerLine(line, END_MARK)) {
      // finalize block
      const cmd = parseKeyValueLines(buf);

      // Strict required fields to avoid false positives
      const id = cmd.id ? String(cmd.id).trim() : "";
      const action = cmd.action ? String(cmd.action).trim() : "";
      const p = cmd.path ? String(cmd.path).trim() : "";
      const needsPath = action.startsWith("fs.");

      if (!id || !action || (needsPath && !p)) {
        warnings.push(
          `Ignored OPERATOR_CMD block (missing ${[
            !id ? "id" : null,
            !action ? "action" : null,
            needsPath && !p ? "path" : null,
          ].filter(Boolean).join(", ")}).`
        );
      } else {
        // normalize typed fields
        cmd.id = id;
        cmd.action = action;
        if (needsPath) cmd.path = p;
        if (cmd.version === undefined) cmd.version = 1;

        commands.push(cmd);
      }

      resetBlock();
      continue;
    }

    // still in block - collect with limits
    buf.push(line);
    bufChars += line.length + 1;

    if (buf.length > MAX_BLOCK_LINES) {
      resetBlock(`Aborted OPERATOR_CMD block: too many lines (>${MAX_BLOCK_LINES}).`);
      continue;
    }
    if (bufChars > MAX_BLOCK_CHARS) {
      resetBlock(`Aborted OPERATOR_CMD block: too many characters (>${MAX_BLOCK_CHARS}).`);
      continue;
    }

    // If another START appears before END, reset to avoid nesting/spanning
    if (isMarkerLine(line, START_MARK)) {
      resetBlock("Aborted OPERATOR_CMD block: nested START marker found before END.");
      // treat this line as a new start
      inBlock = true;
      buf = [];
      bufChars = 0;
    }
  }

  if (inBlock) {
    warnings.push("Aborted OPERATOR_CMD block: reached end of text without END_OPERATOR_CMD.");
  }

  return { commands, warnings };
}

// --- Workspace + filesystem safety ---

let workspaceRoot: string | null = null;

function normalizeRelPath(p: string): string {
  // Normalize slashes, remove leading slashes
  const cleaned = p.replace(/\\/g, "/").replace(/^\/+/, "");
  return cleaned;
}

function resolveInWorkspace(relPath: string): { ok: boolean; absPath?: string; reason?: string } {
  if (!workspaceRoot) return { ok: false, reason: "Workspace not set" };

  const rel = normalizeRelPath(relPath);

  // deny traversal patterns early
  if (rel.includes("..")) return { ok: false, reason: "Path traversal detected" };

  const abs = path.resolve(workspaceRoot, rel);
  const rootAbs = path.resolve(workspaceRoot);

  // Ensure abs is within root
  const within = abs === rootAbs || abs.startsWith(rootAbs + path.sep);
  if (!within) return { ok: false, reason: "Resolved path is outside workspace" };

  return { ok: true, absPath: abs };
}

function riskLevel(action?: string): "read" | "write" | "delete" | "unknown" {
  if (!action) return "unknown";
  if (action === "fs.read" || action === "fs.list" || action === "fs.readSlice" || action === "fs.search") return "read";
  if (action === "fs.write") return "write";
  if (action === "fs.delete") return "delete";
  if (action === "fs.patch") return "write";
  return "unknown";
}

async function confirmDestructive(win: BrowserWindow, title: string, message: string) {
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Cancel", "Confirm"],
    defaultId: 0,
    cancelId: 0,
    title,
    message,
  });
  return response === 1;
}

async function executeFsCommand(win: BrowserWindow, cmd: OperatorCmd): Promise<OperatorResult> {
  const id = cmd.id;
  const action = cmd.action;
  const relPath = cmd.path;

  if (!action || !relPath) {
    return { id, ok: false, summary: "Invalid command: missing action/path" };
  }

  const resolved = resolveInWorkspace(relPath);
  if (!resolved.ok) {
    return { id, ok: false, summary: `Workspace/path error: ${resolved.reason}` };
  }
  const absPath = resolved.absPath!;

  const level = riskLevel(action);

  // confirm write/delete always
  if (level === "write" || level === "delete") {
    const ok = await confirmDestructive(
      win,
      "Confirm action",
      `Do you want to execute:\n\n${action}\n${relPath}\n\nWorkspace:\n${workspaceRoot}`
    );
    if (!ok) return { id, ok: false, summary: "User cancelled" };
  }

  try {
    if (action === "fs.list") {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      const out = entries
        .map((e) => (e.isDirectory() ? `[DIR] ${e.name}` : e.name))
        .join("\n");
      return { id, ok: true, summary: `Listed ${entries.length} entries`, details_b64: b64(out) };
    }

    if (action === "fs.read") {
      const data = await fs.readFile(absPath, "utf-8");
      return { id, ok: true, summary: "Read file", details_b64: b64(data) };
    }

    if (action === "fs.readSlice") {
      const startRaw = (cmd as any).start ?? (cmd as any).line ?? (cmd as any).from;
      const linesRaw = (cmd as any).lines ?? (cmd as any).count ?? (cmd as any).len;

      const startLine = Math.max(1, Number(startRaw ?? 1));
      const maxLines = 400;
      const takeLines = Math.max(1, Math.min(maxLines, Number(linesRaw ?? 120)));

      if (!Number.isFinite(startLine) || !Number.isFinite(takeLines)) {
        return { id, ok: false, summary: "Invalid readSlice: start/lines must be numbers" };
      }

      const data = await fs.readFile(absPath, "utf-8");
      const fileLines = data.split(/\r?\n/);

      const startIdx = Math.min(fileLines.length, Math.max(0, startLine - 1));
      const endIdx = Math.min(fileLines.length, startIdx + takeLines);

      const out: string[] = [];
      out.push(`# ${relPath}`);
      out.push(`# lines ${startIdx + 1}-${endIdx} of ${fileLines.length}`);
      out.push("");

      for (let i = startIdx; i < endIdx; i++) {
        const n = String(i + 1).padStart(6, " ");
        out.push(`${n}: ${fileLines[i] ?? ""}`);
      }

      return { id, ok: true, summary: `Read slice (${startIdx + 1}-${endIdx})`, details_b64: b64(out.join("\n")) };
    }

    if (action === "fs.search") {
      const q1 = typeof (cmd as any).query === "string" ? (cmd as any).query : "";
      const q2 = typeof (cmd as any).q === "string" ? (cmd as any).q : "";
      const query = (q1 || q2).trim();
      if (!query) return { id, ok: false, summary: "Invalid search: missing query" };

      const data = await fs.readFile(absPath, "utf-8");
      const fileLines = data.split(/\r?\n/);

      const maxMatches = 50;
      const matches: Array<{ line: number; text: string }> = [];

      for (let i = 0; i < fileLines.length; i++) {
        if (fileLines[i].includes(query)) {
          matches.push({ line: i + 1, text: fileLines[i] });
          if (matches.length >= maxMatches) break;
        }
      }

      const out: string[] = [];
      out.push(`# search in ${relPath}`);
      out.push(`# query: ${query}`);
      out.push(`# matches: ${matches.length}${matches.length === maxMatches ? " (truncated)" : ""}`);
      out.push("");

      for (const m of matches) {
        const n = String(m.line).padStart(6, " ");
        out.push(`${n}: ${m.text}`);
      }

      return { id, ok: true, summary: `Search found ${matches.length} matches`, details_b64: b64(out.join("\n")) };
    }


    if (action === "fs.write") {
      let content = "";
      if (typeof cmd.content_b64 === "string" && cmd.content_b64.trim()) {
        try {
          content = Buffer.from(String(cmd.content_b64).trim(), "base64").toString("utf-8");
        } catch {
          return { id, ok: false, summary: "Invalid content_b64 (base64 decode failed)" };
        }
      } else {
        content = typeof cmd.content === "string" ? cmd.content : "";
      }

      // Ensure parent exists
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content, "utf-8");
      return { id, ok: true, summary: "Wrote file" };
    }

    if (action === "fs.patch") {
      const patchB64 = typeof cmd.patch_b64 === "string" ? cmd.patch_b64.trim() : "";
      if (!patchB64) return { id, ok: false, summary: "Invalid patch: missing patch_b64" };

      let patchText = "";
      try {
        patchText = Buffer.from(patchB64, "base64").toString("utf-8");
      } catch {
        return { id, ok: false, summary: "Invalid patch_b64 (base64 decode failed)" };
      }

      // Apply a very small, strict unified-diff patcher (single-file)
      const res = await applyUnifiedPatchSingleFile(absPath, patchText);
      if (!res.ok) return { id, ok: false, summary: `Patch failed: ${res.error}` };

      return { id, ok: true, summary: "Patched file" };
    }

    if (action === "fs.applyEdits") {
      const b64 = typeof cmd.edits_b64 === "string" ? cmd.edits_b64.trim() : "";
      if (!b64) return { id, ok: false, summary: "Missing edits_b64" };

      let payload: ApplyEditsPayload;
      try {
        payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      } catch {
        return { id, ok: false, summary: "Invalid edits_b64 JSON" };
      }

      if (!payload || payload.version !== 1 || !Array.isArray(payload.edits)) {
        return { id, ok: false, summary: "Invalid edits payload" };
      }

      const original = await fs.readFile(absPath, "utf-8");
      const res = applyEditsToText(original, payload);
      if (!res.ok) {
        return { id, ok: false, summary: `ApplyEdits failed: ${res.error}` };
      }

      await fs.writeFile(absPath, res.text, "utf-8");
      return { id, ok: true, summary: "Applied edits" };
    }


    if (action === "fs.delete") {
      // Prefer trash for reversibility
      try {
        await shell.trashItem(absPath);
        return { id, ok: true, summary: "Moved to trash" };
      } catch {
        await fs.rm(absPath, { recursive: true, force: true });
        return { id, ok: true, summary: "Deleted" };
      }
    }

    return { id, ok: false, summary: `Unknown action: ${action}` };
  } catch (err: any) {
    return { id, ok: false, summary: `Error: ${String(err?.message ?? err)}` };
  }
}

function formatOperatorResult(r: OperatorResult): string {
  const lines: string[] = [];
  lines.push("OPERATOR_RESULT");
  if (r.id) lines.push(`id: ${r.id}`);
  lines.push(`ok: ${r.ok ? "true" : "false"}`);
  lines.push(`summary: ${r.summary}`);
  if (r.details_b64) lines.push(`details_b64: ${r.details_b64}`);
  lines.push("END_OPERATOR_RESULT");
  return lines.join("\n");
}

function applyEditsToText(
  original: string,
  payload: ApplyEditsPayload
): { ok: true; text: string } | { ok: false; error: string } {
  let text = original;

  for (let i = 0; i < payload.edits.length; i++) {
    const e = payload.edits[i];

    if (e.op === "insertAfter" || e.op === "insertBefore") {
      if (!e.anchor) return { ok: false, error: `Edit ${i}: empty anchor` };

      const occ = Math.max(1, e.occurrence ?? 1);
      let idx = -1;
      let from = 0;

      for (let k = 0; k < occ; k++) {
        idx = text.indexOf(e.anchor, from);
        if (idx === -1) break;
        from = idx + e.anchor.length;
      }

      if (idx === -1)
        return { ok: false, error: `Edit ${i}: anchor not found` };

      const insertPos =
        e.op === "insertAfter" ? idx + e.anchor.length : idx;

      text =
        text.slice(0, insertPos) +
        e.text +
        text.slice(insertPos);
      continue;
    }

    if (e.op === "replaceFirst") {
      const first = text.indexOf(e.find);
      if (first === -1)
        return { ok: false, error: `Edit ${i}: find not found` };

      const second = text.indexOf(e.find, first + e.find.length);
      if (second !== -1)
        return { ok: false, error: `Edit ${i}: multiple matches` };

      text =
        text.slice(0, first) +
        e.text +
        text.slice(first + e.find.length);
      continue;
    }

    if (e.op === "replaceAll") {
      if (!text.includes(e.find))
        return { ok: false, error: `Edit ${i}: no matches` };
      text = text.split(e.find).join(e.text);
      continue;
    }

    if (e.op === "replaceRange") {
      const lines = text.split(/\r?\n/);
      if (
        e.startLine < 1 ||
        e.endLine < e.startLine ||
        e.endLine > lines.length
      ) {
        return { ok: false, error: `Edit ${i}: invalid range` };
      }

      lines.splice(
        e.startLine - 1,
        e.endLine - e.startLine + 1,
        ...e.text.split(/\r?\n/)
      );
      text = lines.join("\n");
      continue;
    }

    return { ok: false, error: `Edit ${i}: unknown op` };
  }

  return { ok: true, text };
}


async function applyUnifiedPatchSingleFile(
  absPath: string,
  patchText: string
): Promise<{ ok: boolean; error?: string }> {
  // Minimal unified diff applier:
  // - expects patch for exactly one file
  // - supports @@ -a,b +c,d @@ hunks
  // - strict line matching
  try {
    const original = await fs.readFile(absPath, "utf-8");
    const origLines = original.split(/\r?\n/);

    const lines = patchText.split(/\r?\n/);

    // Find first hunk
    let i = 0;
    while (i < lines.length && !lines[i].startsWith("@@")) i++;
    if (i >= lines.length) return { ok: false, error: "No hunks (@@ ...) found" };

    let out: string[] = [];
    let origIndex = 0;

    while (i < lines.length) {
      const header = lines[i];
      if (!header.startsWith("@@")) { i++; continue; }

      const m = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!m) return { ok: false, error: "Invalid hunk header" };

      const oldStart = Number(m[1]) - 1; // 0-based
      // copy unchanged lines before hunk
      while (origIndex < oldStart) {
        out.push(origLines[origIndex++]);
      }

      i++; // move into hunk body
      while (i < lines.length) {
        const l = lines[i];

        if (l.startsWith("@@")) break;              // next hunk
        if (l.startsWith("diff ") || l.startsWith("---") || l.startsWith("+++")) { i++; continue; }

        const tag = l.slice(0, 1);
        const text = l.slice(1);

        if (tag === " ") {
          // context line must match
          if (origLines[origIndex] !== text) {
            return { ok: false, error: `Context mismatch at line ${origIndex + 1}` };
          }
          out.push(origLines[origIndex]);
          origIndex++;
        } else if (tag === "-") {
          // removed line must match
          if (origLines[origIndex] !== text) {
            return { ok: false, error: `Remove mismatch at line ${origIndex + 1}` };
          }
          origIndex++;
        } else if (tag === "+") {
          out.push(text);
        } else if (tag === "\\") {
          // "\ No newline at end of file" — ignore
        } else {
          return { ok: false, error: `Invalid hunk line: ${l}` };
        }

        i++;
      }
    }

    // copy remaining lines
    while (origIndex < origLines.length) {
      out.push(origLines[origIndex++]);
    }

    await fs.writeFile(absPath, out.join("\n"), "utf-8");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}


// --- Window + BrowserView ---

function createWindow() {
  app.setName(APP_NAME);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_NAME,
    icon: getAssetPath("icons/win/OperatorIcon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // IMPORTANT: preload only for Operator UI window, NOT for the webchat BrowserView
      preload: path.join(__dirname, "preload.js"),
    },
  });

  applyBranding(win);

  // Harden Operator UI window too (any popups from UI should go external)
  hardenWebContents(win.webContents);

  // Load Operator UI (stays loaded)
  win.loadFile(path.join(app.getAppPath(), "renderer", "index.html")).catch(() => { });

  // Create BrowserView for Webchat
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // no preload here
    },
  });

  win.setBrowserView(view);

  const sidebarWidth = 360;

  function layout() {
    const [w, h] = win.getContentSize();
    view.setBounds({
      x: sidebarWidth,
      y: 0,
      width: Math.max(0, w - sidebarWidth),
      height: h,
    });
    view.setAutoResize({ width: true, height: true });
  }

  layout();
  win.on("resize", layout);

  // Harden the webchat view (THIS is what matters most)
  hardenWebContents(view.webContents);

  // Load webchat
  view.webContents.loadURL(START_URL);

  // ---- IPC handlers ----

  ipcMain.handle("operator:getWorkspace", async () => {
    return { workspaceRoot };
  });

  ipcMain.handle("operator:chooseWorkspace", async () => {
    const res = await dialog.showOpenDialog(win, {
      title: "Choose workspace root",
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, workspaceRoot };
    workspaceRoot = res.filePaths[0];
    return { ok: true, workspaceRoot };
  });

  ipcMain.handle("operator:copy", async (_evt, { text }: { text: string }) => {
    clipboard.writeText(String(text ?? ""));
    return { ok: true };
  });

  ipcMain.handle("operator:getBootstrapPrompt", async () => {
    try {
      const p = path.join(app.getAppPath(), "operator_llm_bootstrap.txt");
      const text = await fs.readFile(p, "utf-8");
      // DoS guard
      const limited = text.length > 200_000 ? text.slice(0, 200_000) : text;
      return { ok: true, text: limited };
    } catch (e: any) {
      return { ok: false, text: "", error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle("operator:extract", async () => {
    // MVP extractor: read-only. Later: host-specific extractor store w/ hash pinning.
    const extractorCode = `
      (() => {
        const text = document.body ? document.body.innerText : "";
        return { text, meta: { url: location.href, host: location.host } };
      })()
    `;

    // true => userGesture (slightly safer and aligns with "on-demand extraction")
    const result = await view.webContents.executeJavaScript(extractorCode, true);
    // Limit size (DoS guard)
    const text = typeof result?.text === "string" ? result.text : "";
    const limited = text.length > 500_000 ? text.slice(0, 500_000) : text;

    return { text: limited, meta: result?.meta ?? null };
  });

  ipcMain.handle("operator:scan", async (_evt, { text }: { text: string }) => {
    const plain = String(text ?? "");
    const { commands, warnings } = scanForCommands(plain);

    // Basic dedupe by id (keep last occurrence)
    const byId = new Map<string, OperatorCmd>();
    const noId: OperatorCmd[] = [];

    for (const c of commands) {
      if (c.id) byId.set(c.id, c);
      else noId.push(c);
    }

    const deduped = [...byId.values(), ...noId];

    return { commands: deduped, warnings };
  });

  ipcMain.handle("operator:execute", async (_evt, { cmd }: { cmd: OperatorCmd }) => {
    // Validate minimal schema
    const v = typeof cmd?.version === "number" ? cmd.version : Number(cmd?.version ?? 1);
    const id = cmd?.id ? String(cmd.id) : undefined;
    const action = cmd?.action ? String(cmd.action) : undefined;
    const p = cmd?.path ? String(cmd.path) : undefined;

    const safeCmd: OperatorCmd = { ...cmd, version: v, id, action, path: p };

    if (action === "operator.getInterfaceSpec") {
      const spec = await readInterfaceSpec();
      if (!spec.ok) {
        const r: OperatorResult = { id, ok: false, summary: `Failed to read interface spec: ${spec.error}` };
        return { result: r, resultText: formatOperatorResult(r) };
      }
      const r: OperatorResult = { id, ok: true, summary: "Interface spec", details_b64: b64(spec.text) };
      return { result: r, resultText: formatOperatorResult(r) };
    }

    const isFs = typeof action === "string" && action.startsWith("fs.");

    if (isFs && !workspaceRoot) {
      const r: OperatorResult = { id, ok: false, summary: "Workspace not set. Choose workspace first." };
      return { result: r, resultText: formatOperatorResult(r) };
    }

    if (isFs) {
      const r = await executeFsCommand(win, safeCmd);
      return { result: r, resultText: formatOperatorResult(r) };
    }

    const r: OperatorResult = { id, ok: false, summary: `Unknown action: ${action ?? ""}` };
    return { result: r, resultText: formatOperatorResult(r) };

  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
