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
import {
  DEFAULT_LLM_ID,
  LLM_PROFILES,
  type LLMId,
  type LLMProfile,
} from "./llmProfiles";
import {
  invalidCmdSummary,
  scanForCommands,
  validateCommandFields,
  validateSearchPathIsFile,
  unknownActionSummary,
  type OperatorCmd,
  type OperatorResult,
} from "./operator_cmd";

const APP_NAME = "Operator";
const MAX_READ_BYTES = 200_000;
const EXTRACT_LIMIT_CHARS = 200_000;

function normalizeStartUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isLlmId(value: string): value is LLMId {
  return Object.prototype.hasOwnProperty.call(LLM_PROFILES, value);
}

function getProfile(id?: string | null): LLMProfile {
  if (id && isLlmId(id)) return LLM_PROFILES[id];
  return LLM_PROFILES[DEFAULT_LLM_ID];
}

function buildAllowedHosts(profile: LLMProfile, overrideUrl?: string | null): Set<string> {
  const hosts = new Set(profile.allowedHosts);
  if (!overrideUrl) return hosts;
  try {
    const url = new URL(overrideUrl);
    hosts.add(url.hostname);
  } catch {
    // ignore invalid override
  }
  return hosts;
}

const START_URL_OVERRIDE = normalizeStartUrl(process.env.OPERATOR_START_URL);
const ENV_LLM_ID = process.env.OPERATOR_LLM_ID;
const INITIAL_LLM_ID: LLMId = isLlmId(ENV_LLM_ID ?? "") ? (ENV_LLM_ID as LLMId) : DEFAULT_LLM_ID;

let allowedHosts = new Set<string>();

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return allowedHosts.has(u.hostname);
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
  // Popups / window.open -> extern oeffnen
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
    return {
      id,
      ok: false,
      summary: invalidCmdSummary("ERR_MISSING_REQUIRED_FIELDS", "missing action/path."),
    };
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
      const stat = await fs.stat(absPath);
      if (stat.size > MAX_READ_BYTES) {
        return {
          id,
          ok: false,
          summary: `File too large for fs.read (${stat.size} bytes). Use fs.readSlice.`,
        };
      }
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
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_READSLICE_PARAMS", "start/lines must be numbers."),
        };
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
      if (!query) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_MISSING_QUERY", "missing query; use query: <text>."),
        };
      }

      const searchCheck = await validateSearchPathIsFile(absPath);
      if (!searchCheck.ok) {
        return { id, ok: false, summary: searchCheck.summary };
      }

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
          return {
            id,
            ok: false,
            summary: invalidCmdSummary("ERR_INVALID_BASE64", "field=content_b64 is not valid base64."),
          };
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
      if (!patchB64) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_MISSING_PATCH_B64", "patch_b64 is required."),
        };
      }

      let patchText = "";
      try {
        patchText = Buffer.from(patchB64, "base64").toString("utf-8");
      } catch {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_BASE64", "field=patch_b64 is not valid base64."),
        };
      }

      // Apply a very small, strict unified-diff patcher (single-file)
      const res = await applyUnifiedPatchSingleFile(absPath, patchText);
      if (!res.ok) return { id, ok: false, summary: `Patch failed: ${res.error}` };

      return { id, ok: true, summary: "Patched file" };
    }

    if (action === "fs.applyEdits") {
      const b64 = typeof cmd.edits_b64 === "string" ? cmd.edits_b64.trim() : "";
      if (!b64) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_MISSING_EDITS_B64", "edits_b64 is required."),
        };
      }

      let payload: ApplyEditsPayload;
      try {
        payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      } catch {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_EDITS_JSON", "edits_b64 is not valid JSON."),
        };
      }

      if (!payload || payload.version !== 1 || !Array.isArray(payload.edits)) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_EDITS_JSON", "edits_b64 payload is invalid."),
        };
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

    return { id, ok: false, summary: unknownActionSummary(action) };
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

      let insertText = e.text;
      if (e.op === "insertAfter") {
        const anchorLooksLine = !e.anchor.includes("\n");
        const nextChar = text[insertPos];
        const atLineEnd = nextChar === "\n" || nextChar === undefined;
        if (anchorLooksLine && atLineEnd && !insertText.startsWith("\n")) {
          insertText = `\n${insertText}`;
        }
      }

      text =
        text.slice(0, insertPos) +
        insertText +
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
          // "\ No newline at end of file" - ignore
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

  let activeProfileId = INITIAL_LLM_ID;
  let startUrlOverride: string | null = START_URL_OVERRIDE;
  let activeProfile = getProfile(activeProfileId);

  allowedHosts = buildAllowedHosts(activeProfile, startUrlOverride);

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

  function setActiveProfile(id: LLMId) {
    activeProfileId = id;
    activeProfile = getProfile(activeProfileId);
    startUrlOverride = null;
    allowedHosts = buildAllowedHosts(activeProfile, null);
    view.webContents.loadURL(activeProfile.startUrl);
  }

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
  const startUrl = startUrlOverride ?? activeProfile.startUrl;
  view.webContents.loadURL(startUrl);

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

  ipcMain.handle("operator:getLlmProfiles", async () => {
    const profiles = Object.values(LLM_PROFILES).map((p) => ({ id: p.id, label: p.label }));
    return { profiles };
  });

  ipcMain.handle("operator:getActiveLlmProfile", async () => {
    return { id: activeProfile.id, label: activeProfile.label };
  });

  ipcMain.handle("operator:setLlmProfile", async (_evt, { id }: { id: string }) => {
    if (!isLlmId(id)) return { ok: false, error: "Unknown LLM profile" };
    setActiveProfile(id);
    return { ok: true, id: activeProfile.id, label: activeProfile.label };
  });

  ipcMain.handle("operator:getBootstrapPrompt", async () => {
    try {
      const profile = activeProfile;
      const primary = profile.bootstrapPromptFile || "operator_llm_bootstrap.txt";
      const fallback = "operator_llm_bootstrap.txt";
      const candidates = primary === fallback ? [primary] : [primary, fallback];

      let lastError = "";
      for (const file of candidates) {
        try {
          const p = path.join(app.getAppPath(), file);
          const text = await fs.readFile(p, "utf-8");
          // DoS guard
          const limited = text.length > 200_000 ? text.slice(0, 200_000) : text;
          return { ok: true, text: limited, profileId: profile.id, profileLabel: profile.label };
        } catch (e: any) {
          lastError = String(e?.message ?? e);
        }
      }
      return { ok: false, text: "", error: lastError, profileId: profile.id, profileLabel: profile.label };
    } catch (e: any) {
      return { ok: false, text: "", error: String(e?.message ?? e), profileId: activeProfile.id, profileLabel: activeProfile.label };
    }
  });

  ipcMain.handle("operator:getSmokeTestPrompt", async () => {
    try {
      const p = path.join(app.getAppPath(), "operator_llm_smoketest.txt");
      const text = await fs.readFile(p, "utf-8");
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
    // Limit size (DoS guard) and keep the tail to favor recent context.
    const text = typeof result?.text === "string" ? result.text : "";
    const limited = text.length > EXTRACT_LIMIT_CHARS
      ? text.slice(text.length - EXTRACT_LIMIT_CHARS)
      : text;

    return { text: limited, meta: result?.meta ?? null };
  });

  ipcMain.handle("operator:scan", async (_evt, { text }: { text: string }) => {
    const plain = String(text ?? "");
    const trimmed = plain.length > EXTRACT_LIMIT_CHARS;
    const scanText = trimmed ? plain.slice(plain.length - EXTRACT_LIMIT_CHARS) : plain;
    const { commands, warnings } = scanForCommands(scanText);
    if (trimmed) {
      warnings.unshift(`Scan input trimmed to last ${EXTRACT_LIMIT_CHARS} chars.`);
    }

    // Dedupe by id while preserving order of last occurrence.
    const deduped: Array<OperatorCmd | null> = [];
    const seenIndex = new Map<string, number>();

    for (const c of commands) {
      if (c.id) {
        const id = String(c.id);
        const prevIndex = seenIndex.get(id);
        if (prevIndex !== undefined) {
          deduped[prevIndex] = null;
        }
        seenIndex.set(id, deduped.length);
      }
      deduped.push(c);
    }

    const finalCommands = deduped.filter((c): c is OperatorCmd => Boolean(c));
    return { commands: finalCommands, warnings };
  });

  ipcMain.handle("operator:execute", async (_evt, { cmd }: { cmd: OperatorCmd }) => {
    // Validate minimal schema
    const id = cmd?.id ? String(cmd.id) : undefined;
    const action = cmd?.action ? String(cmd.action) : undefined;
    const p = cmd?.path ? String(cmd.path) : undefined;

    const rawCmd: OperatorCmd = { ...cmd, id, action, path: p };
    const validation = validateCommandFields(rawCmd);
    if (!validation.ok) {
      const r: OperatorResult = {
        id,
        ok: false,
        summary: invalidCmdSummary(validation.code, validation.detail),
      };
      return { result: r, resultText: formatOperatorResult(r) };
    }

    const v = typeof cmd?.version === "number" ? cmd.version : Number(cmd?.version ?? 1);
    const safeCmd: OperatorCmd = { ...rawCmd, version: v };

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

    const r: OperatorResult = {
      id,
      ok: false,
      summary: unknownActionSummary(action),
    };
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
