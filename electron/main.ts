// electron/main.ts
import {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  ipcMain,
  clipboard,
  dialog,
  Menu,
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

const APP_NAME = "Operator — Human-in-the-Loop";
const MAX_READ_BYTES = 200_000;
const MAX_READSLICE_BYTES = 2_000_000;
const MAX_SEARCH_BYTES = 2_000_000;
const MAX_SEARCHTREE_BYTES = 500_000;
const MAX_SEARCHTREE_FILES = 300;
const MAX_SEARCHTREE_MATCHES = 200;
const EXTRACT_LIMIT_CHARS = 200_000;

type Appearance = {
  id: string;
  label: string;
  vars: Record<string, string>;
};

const DEFAULT_APPEARANCES: Appearance[] = [
  {
    id: "operator-classic",
    label: "Operator Classic",
    vars: {
      "--app-bg": "#e7edf4",
      "--panel-bg": "#f9fbfe",
      "--panel-bg-alt": "#eef3f8",
      "--text": "#1b2430",
      "--text-muted": "#5a6778",
      "--border": "#c9d3df",
      "--accent": "#1a5fbf",
      "--accent-muted": "#d9e6f7",
      "--error": "#8a0b0b",
      "--warning": "#a26100",
      "--overlay-bg": "rgba(0, 0, 0, 0.25)",
      "--modal-bg": "#f9fbfe",
      "--modal-header-bg": "#eef3f8",
      "--modal-footer-bg": "#eef3f8",
      "--modal-shadow": "rgba(0, 0, 0, 0.16)",
      "--focus-ring": "rgba(26, 95, 191, 0.38)",
      "--button-primary-text": "#ffffff",
      "--control-bg": "#f9fbfe",
      "--control-text": "#1b2430",
      "--control-border": "#c9d3df",
      "--error-bg": "#fff4f4",
      "--error-border": "#f1c0c0",
      "--success": "#2f8f59",
      "--success-border": "#1f6b3b",
      "--success-bg": "#f4fbf7",
      "--warning-bg": "#fff7e0",
      "--warning-accent": "#d08a0f",
      "--danger": "#c62828",
      "--danger-active": "#a31f1f",
      "--topbar-divider": "rgba(26, 95, 191, 0.2)",
      "--topbar-shadow": "rgba(0, 0, 0, 0.06)",
      "--toast-bg": "rgba(25, 25, 25, 0.92)",
      "--toast-error-bg": "rgba(110, 0, 0, 0.92)",
      "--toast-text": "#ffffff",
      "--toast-shadow": "rgba(0, 0, 0, 0.2)",
    },
  },
  {
    id: "operator-dark-ops",
    label: "Operator Dark Ops",
    vars: {
      "--app-bg": "#0f141b",
      "--panel-bg": "#151b23",
      "--panel-bg-alt": "#1c2430",
      "--text": "#e6edf3",
      "--text-muted": "#9aa7b5",
      "--border": "#2a3442",
      "--accent": "#4da3ff",
      "--accent-muted": "#223a55",
      "--error": "#ff6b6b",
      "--warning": "#f3b34c",
      "--toast-bg": "rgba(10, 12, 15, 0.95)",
      "--toast-error-bg": "rgba(92, 0, 120, 0.95)",
      "--toast-text": "#ffffff",
      "--overlay-bg": "rgba(0, 0, 0, 0.55)",
      "--modal-bg": "#10151c",
      "--modal-header-bg": "#151b23",
      "--modal-footer-bg": "#151b23",
      "--modal-shadow": "rgba(0, 0, 0, 0.65)",
      "--focus-ring": "rgba(77, 163, 255, 0.45)",
      "--button-primary-text": "#ffffff",
      "--control-bg": "#0f141b",
      "--control-text": "#e6edf3",
      "--control-border": "#2a3442",
      "--error-bg": "#2a1416",
      "--error-border": "#5a2a2f",
      "--success": "#35a46a",
      "--success-border": "#2a7f54",
      "--success-bg": "#0f1e16",
      "--warning-bg": "#2a1f0b",
      "--warning-accent": "#f3b34c",
      "--danger": "#dd3333",
      "--danger-active": "#b21f1f",
      "--topbar-divider": "rgba(77, 163, 255, 0.22)",
      "--topbar-shadow": "rgba(0, 0, 0, 0.2)",
      "--toast-shadow": "rgba(0, 0, 0, 0.55)",
    },
  },
  {
    id: "slate",
    label: "Slate",
    vars: {
      "--app-bg": "#eef1f5",
      "--panel-bg": "#ffffff",
      "--panel-bg-alt": "#f0f3f7",
      "--text": "#1f2933",
      "--text-muted": "#6b7785",
      "--border": "#cdd5df",
      "--accent": "#1b65d1",
      "--accent-muted": "#dbe6ff",
      "--error": "#8a0b0b",
      "--warning": "#a26100",
      "--overlay-bg": "rgba(0, 0, 0, 0.25)",
      "--modal-bg": "#ffffff",
      "--modal-header-bg": "#f0f3f7",
      "--modal-footer-bg": "#f0f3f7",
      "--modal-shadow": "rgba(0, 0, 0, 0.15)",
      "--focus-ring": "rgba(27, 101, 209, 0.38)",
      "--button-primary-text": "#ffffff",
      "--control-bg": "#ffffff",
      "--control-text": "#1f2933",
      "--control-border": "#cdd5df",
      "--error-bg": "#fff4f4",
      "--error-border": "#f1c0c0",
      "--success": "#2f8f59",
      "--success-border": "#1f6b3b",
      "--success-bg": "#f4fbf7",
      "--warning-bg": "#fff7e0",
      "--warning-accent": "#d08a0f",
      "--danger": "#c62828",
      "--danger-active": "#a31f1f",
      "--topbar-divider": "rgba(27, 101, 209, 0.2)",
      "--topbar-shadow": "rgba(0, 0, 0, 0.06)",
      "--toast-bg": "rgba(20, 22, 26, 0.92)",
      "--toast-error-bg": "rgba(110, 0, 0, 0.92)",
      "--toast-text": "#ffffff",
      "--toast-shadow": "rgba(0, 0, 0, 0.2)",
    },
  },
  {
    id: "paper",
    label: "Paper",
    vars: {
      "--app-bg": "#fbfaf7",
      "--panel-bg": "#ffffff",
      "--panel-bg-alt": "#f6f1ea",
      "--text": "#2a241b",
      "--text-muted": "#766e63",
      "--border": "#e2d9cc",
      "--accent": "#2a5ea8",
      "--accent-muted": "#e4ecf6",
      "--error": "#8a0b0b",
      "--warning": "#a26100",
      "--overlay-bg": "rgba(0, 0, 0, 0.2)",
      "--modal-bg": "#ffffff",
      "--modal-header-bg": "#f6f1ea",
      "--modal-footer-bg": "#f6f1ea",
      "--modal-shadow": "rgba(0, 0, 0, 0.16)",
      "--focus-ring": "rgba(42, 94, 168, 0.3)",
      "--button-primary-text": "#ffffff",
      "--control-bg": "#ffffff",
      "--control-text": "#2a241b",
      "--control-border": "#e2d9cc",
      "--error-bg": "#fff4f4",
      "--error-border": "#f1c0c0",
      "--success": "#2f8f59",
      "--success-border": "#1f6b3b",
      "--success-bg": "#f4fbf7",
      "--warning-bg": "#fff7e0",
      "--warning-accent": "#d08a0f",
      "--danger": "#c62828",
      "--danger-active": "#a31f1f",
      "--topbar-divider": "rgba(42, 94, 168, 0.16)",
      "--topbar-shadow": "rgba(0, 0, 0, 0.06)",
      "--toast-bg": "rgba(30, 28, 24, 0.92)",
      "--toast-error-bg": "rgba(110, 0, 0, 0.92)",
      "--toast-text": "#ffffff",
      "--toast-shadow": "rgba(0, 0, 0, 0.22)",
    },
  },
];

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
  return Object.prototype.hasOwnProperty.call(currentProfiles, value);
}

function getProfile(id?: string | null): LLMProfile {
  if (id && isLlmId(id)) return currentProfiles[id];
  return currentProfiles[DEFAULT_LLM_ID] ?? Object.values(currentProfiles)[0];
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
const INITIAL_LLM_ID: LLMId = (ENV_LLM_ID ?? DEFAULT_LLM_ID) as LLMId;

let allowedHosts = new Set<string>();
let currentProfiles: Record<string, LLMProfile> = { ...LLM_PROFILES };
let currentAppearances: Appearance[] = [...DEFAULT_APPEARANCES];
let previewAppearanceVars: Record<string, string> | null = null;

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

function getUserAppearancePath() {
  return path.join(app.getPath("userData"), "appearance.json");
}

function getUserAppearancesPath() {
  return path.join(app.getPath("userData"), "appearances.json");
}

function getUserProfilesPath() {
  return path.join(app.getPath("userData"), "llm_profiles.json");
}

function sanitizeProfile(raw: any): LLMProfile | null {
  if (!raw) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const startUrl = typeof raw.startUrl === "string" ? raw.startUrl.trim() : "";
  if (!id || !startUrl) return null;
  let url: URL;
  try {
    url = new URL(startUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const allowed = Array.isArray(raw.allowedHosts) ? (raw.allowedHosts as unknown[]) : [];
  const allowedHosts = Array.from(new Set(
    allowed
      .map((h: unknown) => String(h ?? "").trim())
      .filter((h) => h.length > 0)
  ));
  const mergedHosts = allowedHosts.length ? allowedHosts : [url.hostname];
  return {
    id,
    label: label || id,
    startUrl: url.toString(),
    allowedHosts: mergedHosts,
    bootstrapPromptFile: "operator_llm_bootstrap.txt",
  };
}

async function loadUserProfiles(): Promise<LLMProfile[] | null> {
  try {
    const raw = await fs.readFile(getUserProfilesPath(), "utf-8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.profiles) ? parsed.profiles : [];
    const out = list.map(sanitizeProfile).filter(Boolean) as LLMProfile[];
    if (!out.length) return null;
    const unique = new Map<string, LLMProfile>();
    for (const profile of out) {
      unique.set(profile.id, profile);
    }
    const deduped = Array.from(unique.values());
    return deduped.length ? deduped : null;
  } catch {
    return null;
  }
}

async function saveUserProfiles(profiles: LLMProfile[]) {
  const payload = { profiles };
  await fs.writeFile(getUserProfilesPath(), JSON.stringify(payload, null, 2), "utf-8");
}

async function resetUserProfiles() {
  try {
    await fs.rm(getUserProfilesPath(), { force: true });
  } catch {}
}

async function loadAppearanceId(): Promise<string | null> {
  try {
    const raw = await fs.readFile(getUserAppearancePath(), "utf-8");
    const parsed = JSON.parse(raw);
    const id = typeof parsed?.id === "string" ? parsed.id : null;
    return id;
  } catch {
    return null;
  }
}

async function saveAppearanceId(id: string) {
  const payload = { id };
  await fs.writeFile(getUserAppearancePath(), JSON.stringify(payload, null, 2), "utf-8");
}

function sanitizeAppearance(raw: any): Appearance | null {
  if (!raw) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const vars = raw.vars && typeof raw.vars === "object" ? raw.vars : {};
  if (!id) return null;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    const k = String(key || "").trim();
    const v = String(value || "").trim();
    if (!k || !v) continue;
    cleaned[k] = v;
  }
  return { id, label: label || id, vars: cleaned };
}

async function loadUserAppearances(): Promise<Appearance[] | null> {
  try {
    const raw = await fs.readFile(getUserAppearancesPath(), "utf-8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.appearances) ? parsed.appearances : [];
    const out = list.map(sanitizeAppearance).filter(Boolean) as Appearance[];
    if (!out.length) return null;
    const unique = new Map<string, Appearance>();
    for (const appearance of out) {
      unique.set(appearance.id, appearance);
    }
    return Array.from(unique.values());
  } catch {
    return null;
  }
}

async function saveUserAppearances(list: Appearance[]) {
  const payload = { appearances: list };
  await fs.writeFile(getUserAppearancesPath(), JSON.stringify(payload, null, 2), "utf-8");
}

async function resetUserAppearances() {
  try {
    await fs.rm(getUserAppearancesPath(), { force: true });
  } catch {}
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

type CommentStyle =
  | { type: "line"; linePrefix: string; language: string; source: "map" | "explicit" }
  | { type: "block"; blockStart: string; blockEnd: string; language: string; source: "map" | "explicit" };

type CommentStyleMapEntry =
  | { type: "line"; linePrefix: string; language: string }
  | { type: "block"; blockStart: string; blockEnd: string; language: string };

const COMMENT_LANGUAGE_ALIASES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  "c++": "cpp",
  "c#": "cs",
  shell: "sh",
  bash: "sh",
  zsh: "sh",
  powershell: "ps1",
  markdown: "md",
};

const COMMENT_STYLE_MAP: Record<string, CommentStyleMapEntry> = {
  js: { type: "line", linePrefix: "//", language: "js" },
  ts: { type: "line", linePrefix: "//", language: "ts" },
  jsx: { type: "line", linePrefix: "//", language: "jsx" },
  tsx: { type: "line", linePrefix: "//", language: "tsx" },
  java: { type: "line", linePrefix: "//", language: "java" },
  c: { type: "line", linePrefix: "//", language: "c" },
  cpp: { type: "line", linePrefix: "//", language: "cpp" },
  h: { type: "line", linePrefix: "//", language: "h" },
  hpp: { type: "line", linePrefix: "//", language: "hpp" },
  cs: { type: "line", linePrefix: "//", language: "cs" },
  go: { type: "line", linePrefix: "//", language: "go" },
  rs: { type: "line", linePrefix: "//", language: "rs" },
  swift: { type: "line", linePrefix: "//", language: "swift" },
  kt: { type: "line", linePrefix: "//", language: "kt" },
  kts: { type: "line", linePrefix: "//", language: "kts" },
  scala: { type: "line", linePrefix: "//", language: "scala" },
  groovy: { type: "line", linePrefix: "//", language: "groovy" },
  py: { type: "line", linePrefix: "#", language: "py" },
  rb: { type: "line", linePrefix: "#", language: "rb" },
  pl: { type: "line", linePrefix: "#", language: "pl" },
  sh: { type: "line", linePrefix: "#", language: "sh" },
  ps1: { type: "line", linePrefix: "#", language: "ps1" },
  psm1: { type: "line", linePrefix: "#", language: "psm1" },
  psd1: { type: "line", linePrefix: "#", language: "psd1" },
  yaml: { type: "line", linePrefix: "#", language: "yaml" },
  yml: { type: "line", linePrefix: "#", language: "yml" },
  toml: { type: "line", linePrefix: "#", language: "toml" },
  ini: { type: "line", linePrefix: "#", language: "ini" },
  cfg: { type: "line", linePrefix: "#", language: "cfg" },
  conf: { type: "line", linePrefix: "#", language: "conf" },
  properties: { type: "line", linePrefix: "#", language: "properties" },
  lua: { type: "line", linePrefix: "--", language: "lua" },
  sql: { type: "line", linePrefix: "--", language: "sql" },
  css: { type: "block", blockStart: "/*", blockEnd: "*/", language: "css" },
  scss: { type: "block", blockStart: "/*", blockEnd: "*/", language: "scss" },
  less: { type: "block", blockStart: "/*", blockEnd: "*/", language: "less" },
  html: { type: "block", blockStart: "<!--", blockEnd: "-->", language: "html" },
  xml: { type: "block", blockStart: "<!--", blockEnd: "-->", language: "xml" },
  svg: { type: "block", blockStart: "<!--", blockEnd: "-->", language: "svg" },
  md: { type: "block", blockStart: "<!--", blockEnd: "-->", language: "md" },
};

function normalizeLanguageId(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

function getCommentStyleForLanguage(langRaw: string): CommentStyle | null {
  const normalized = normalizeLanguageId(langRaw);
  if (!normalized) return null;
  const key = COMMENT_LANGUAGE_ALIASES[normalized] ?? normalized;
  const style = COMMENT_STYLE_MAP[key];
  if (!style) return null;
  if (style.type === "line") {
    return { type: "line", linePrefix: style.linePrefix, language: style.language, source: "map" };
  }
  return { type: "block", blockStart: style.blockStart, blockEnd: style.blockEnd, language: style.language, source: "map" };
}

function getCommentStyleForPath(relPath: string): CommentStyle | null {
  const base = path.basename(relPath || "");
  if (base.toLowerCase() === "dockerfile") {
    return { type: "line", linePrefix: "#", language: "dockerfile", source: "map" };
  }
  const ext = path.extname(relPath || "").toLowerCase().replace(".", "");
  if (!ext) return null;
  return getCommentStyleForLanguage(ext);
}

function resolveCommentStyle(cmd: OperatorCmd, relPath: string): { ok: true; style: CommentStyle } | { ok: false; summary: string } {
  const linePrefixRaw = typeof (cmd as any).comment_line_prefix === "string" ? String((cmd as any).comment_line_prefix) : "";
  const blockStartRaw = typeof (cmd as any).comment_block_start === "string" ? String((cmd as any).comment_block_start) : "";
  const blockEndRaw = typeof (cmd as any).comment_block_end === "string" ? String((cmd as any).comment_block_end) : "";
  const languageRaw = typeof (cmd as any).language === "string" ? String((cmd as any).language) : "";

  const hasLine = linePrefixRaw.trim().length > 0;
  const hasBlockStart = blockStartRaw.trim().length > 0;
  const hasBlockEnd = blockEndRaw.trim().length > 0;

  if (hasLine && (hasBlockStart || hasBlockEnd)) {
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_INVALID_COMMENT_STYLE", "Use either comment_line_prefix or comment_block_start/comment_block_end."),
    };
  }
  if ((hasBlockStart && !hasBlockEnd) || (!hasBlockStart && hasBlockEnd)) {
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_INVALID_COMMENT_STYLE", "comment_block_start and comment_block_end must both be set."),
    };
  }
  if (hasLine) {
    return {
      ok: true,
      style: {
        type: "line",
        linePrefix: linePrefixRaw.trim(),
        language: "explicit",
        source: "explicit",
      },
    };
  }
  if (hasBlockStart && hasBlockEnd) {
    return {
      ok: true,
      style: {
        type: "block",
        blockStart: blockStartRaw.trim(),
        blockEnd: blockEndRaw.trim(),
        language: "explicit",
        source: "explicit",
      },
    };
  }

  if (languageRaw.trim()) {
    const style = getCommentStyleForLanguage(languageRaw.trim());
    if (!style) {
      return {
        ok: false,
        summary: invalidCmdSummary("ERR_UNKNOWN_LANGUAGE", `unknown language '${languageRaw.trim()}'`),
      };
    }
    return { ok: true, style };
  }

  const byPath = getCommentStyleForPath(relPath);
  if (!byPath) {
    return {
      ok: false,
      summary: invalidCmdSummary(
        "ERR_COMMENT_STYLE_REQUIRED",
        "comment style not known for path; set comment_line_prefix or comment_block_start/comment_block_end."
      ),
    };
  }
  return { ok: true, style: byPath };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMarkerRegexes(style: CommentStyle, markerId: string): { begin: RegExp; end: RegExp } {
  const id = escapeRegExp(markerId);
  if (style.type === "line") {
    const prefix = escapeRegExp(style.linePrefix);
    return {
      begin: new RegExp(`^\\s*${prefix}\\s*OPERATOR_BEGIN\\s+${id}\\s*$`),
      end: new RegExp(`^\\s*${prefix}\\s*OPERATOR_END\\s+${id}\\s*$`),
    };
  }
  const start = escapeRegExp(style.blockStart);
  const end = escapeRegExp(style.blockEnd);
  return {
    begin: new RegExp(`^\\s*${start}\\s*OPERATOR_BEGIN\\s+${id}\\s*${end}\\s*$`),
    end: new RegExp(`^\\s*${start}\\s*OPERATOR_END\\s+${id}\\s*${end}\\s*$`),
  };
}

function buildMarkerLines(style: CommentStyle, markerId: string): { begin: string; end: string } {
  if (style.type === "line") {
    const prefix = style.linePrefix;
    return {
      begin: `${prefix} OPERATOR_BEGIN ${markerId}`,
      end: `${prefix} OPERATOR_END ${markerId}`,
    };
  }
  return {
    begin: `${style.blockStart} OPERATOR_BEGIN ${markerId} ${style.blockEnd}`,
    end: `${style.blockStart} OPERATOR_END ${markerId} ${style.blockEnd}`,
  };
}

function buildMarkerCaptureRegexes(style: CommentStyle): { begin: RegExp; end: RegExp } {
  if (style.type === "line") {
    const prefix = escapeRegExp(style.linePrefix);
    return {
      begin: new RegExp(`^\\s*${prefix}\\s*OPERATOR_BEGIN\\s+(\\S+)\\s*$`),
      end: new RegExp(`^\\s*${prefix}\\s*OPERATOR_END\\s+(\\S+)\\s*$`),
    };
  }
  const start = escapeRegExp(style.blockStart);
  const end = escapeRegExp(style.blockEnd);
  return {
    begin: new RegExp(`^\\s*${start}\\s*OPERATOR_BEGIN\\s+(\\S+)\\s*${end}\\s*$`),
    end: new RegExp(`^\\s*${start}\\s*OPERATOR_END\\s+(\\S+)\\s*${end}\\s*$`),
  };
}

function findRegion(lines: string[], style: CommentStyle, markerId: string): { ok: true; begin: number; end: number } | { ok: false; summary: string } {
  const regexes = buildMarkerRegexes(style, markerId);
  let begin = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (regexes.begin.test(line)) {
      if (begin !== -1) {
        return {
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_NOT_UNIQUE", `multiple OPERATOR_BEGIN markers for marker_id=${markerId}.`),
        };
      }
      begin = i;
      continue;
    }
    if (regexes.end.test(line)) {
      if (end !== -1) {
        return {
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_NOT_UNIQUE", `multiple OPERATOR_END markers for marker_id=${markerId}.`),
        };
      }
      end = i;
      continue;
    }
  }

  if (begin === -1 || end === -1) {
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_REGION_MARKER_NOT_FOUND", `missing OPERATOR_BEGIN/END for marker_id=${markerId}.`),
    };
  }
  if (end < begin) {
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_REGION_MARKER_ORDER", "OPERATOR_END appears before OPERATOR_BEGIN."),
    };
  }
  return { ok: true, begin, end };
}

function listRegions(lines: string[], style: CommentStyle): { ok: true; regions: Array<{ marker_id: string; begin_line: number; end_line: number; content_start_line: number; content_end_line: number; content_lines: number }> } | { ok: false; summary: string } {
  const regexes = buildMarkerCaptureRegexes(style);
  const open = new Map<string, number>();
  const seen = new Set<string>();
  const regions: Array<{ marker_id: string; begin_line: number; end_line: number; content_start_line: number; content_end_line: number; content_lines: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const beginMatch = regexes.begin.exec(line);
    if (beginMatch) {
      const id = beginMatch[1];
      if (open.has(id) || seen.has(id)) {
        return {
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_NOT_UNIQUE", `multiple OPERATOR_BEGIN/END markers for marker_id=${id}.`),
        };
      }
      open.set(id, i);
      continue;
    }

    const endMatch = regexes.end.exec(line);
    if (endMatch) {
      const id = endMatch[1];
      const beginIndex = open.get(id);
      if (beginIndex === undefined) {
        return {
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_ORDER", `OPERATOR_END appears before OPERATOR_BEGIN for marker_id=${id}.`),
        };
      }
      if (i <= beginIndex) {
        return {
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_ORDER", `OPERATOR_END appears before OPERATOR_BEGIN for marker_id=${id}.`),
        };
      }
      open.delete(id);
      seen.add(id);
      const beginLine = beginIndex + 1;
      const endLine = i + 1;
      const contentStart = beginLine + 1;
      const contentEnd = endLine - 1;
      const contentLines = Math.max(0, endLine - beginLine - 1);
      regions.push({
        marker_id: id,
        begin_line: beginLine,
        end_line: endLine,
        content_start_line: contentStart,
        content_end_line: contentEnd,
        content_lines: contentLines,
      });
      continue;
    }
  }

  if (open.size > 0) {
    const first = open.keys().next().value;
    return {
      ok: false,
      summary: invalidCmdSummary("ERR_REGION_MARKER_MISMATCH", `missing OPERATOR_END for marker_id=${first}.`),
    };
  }

  return { ok: true, regions };
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
let recentWorkspaces: string[] = [];

function getRecentWorkspacesPath() {
  return path.join(app.getPath("userData"), "recent_workspaces.json");
}

async function loadRecentWorkspaces(): Promise<string[]> {
  try {
    const raw = await fs.readFile(getRecentWorkspacesPath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
  } catch {}
  return [];
}

async function saveRecentWorkspaces() {
  try {
    await fs.writeFile(getRecentWorkspacesPath(), JSON.stringify(recentWorkspaces, null, 2), "utf-8");
  } catch {}
}

function addRecentWorkspace(root: string) {
  const trimmed = root.trim();
  if (!trimmed) return;
  recentWorkspaces = [trimmed, ...recentWorkspaces.filter((r) => r !== trimmed)].slice(0, 10);
  saveRecentWorkspaces().catch(() => {});
}

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
  if (action === "fs.read" || action === "fs.list" || action === "fs.readSlice" || action === "fs.search" || action === "fs.readRegion" || action === "fs.listRegions" || action === "fs.stat" || action === "fs.searchTree") return "read";
  if (action === "fs.write" || action === "fs.patch" || action === "fs.applyEdits" || action === "fs.replaceRegion" || action === "fs.deleteRegion" || action === "fs.insertRegion" || action === "fs.copy" || action === "fs.move" || action === "fs.rename") return "write";
  if (action === "fs.delete") return "delete";
  return "unknown";
}

async function confirmDestructive(win: BrowserWindow, title: string, message: string) {
  const { response } = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Cancel", "Confirm"],
    defaultId: 0,
    cancelId: 0,
    title,
    message,
  });
  return response === 1;
}

async function copyPath(src: string, dest: string) {
  const cp = (fs as any).cp;
  if (typeof cp === "function") {
    await cp(src, dest, { recursive: true, force: true });
    return;
  }
  const stat = await fs.lstat(src);
  if (stat.isSymbolicLink()) {
    const link = await fs.readlink(src);
    await fs.symlink(link, dest);
    return;
  }
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyPath(from, to);
      } else if (entry.isSymbolicLink()) {
        const link = await fs.readlink(from);
        await fs.symlink(link, to);
      } else {
        await fs.copyFile(from, to);
      }
    }
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
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
  const normalizeRel = (p: string) => normalizeRelPath(p.replace(/\\/g, "/"));
  const toRelPath = (p: string) => normalizeRel(path.relative(workspaceRoot ?? "", p));
  const needsPathTo = action === "fs.copy" || action === "fs.move" || action === "fs.rename";
  const relPathTo = needsPathTo && typeof (cmd as any).path_to === "string"
    ? String((cmd as any).path_to).trim()
    : "";
  const resolvedTo = needsPathTo ? resolveInWorkspace(relPathTo) : null;
  if (needsPathTo && resolvedTo && !resolvedTo.ok) {
    return { id, ok: false, summary: `Workspace/path error: ${resolvedTo.reason}` };
  }
  const absPathTo = resolvedTo ? resolvedTo.absPath! : undefined;

  const level = riskLevel(action);

  // confirm write/delete always
  if (level === "write" || level === "delete") {
    const destInfo = relPathTo ? `\n\nPath to:\n${relPathTo}` : "";
    const ok = await confirmDestructive(
      win,
      "Confirm action",
      `Do you want to execute:\n\n${action}\n${relPath}${destInfo}\n\nWorkspace:\n${workspaceRoot}`
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

    if (action === "fs.stat") {
      const stat = await fs.stat(absPath);
      const payload = {
        path: relPath,
        size: stat.size,
        isFile: stat.isFile(),
        isDir: stat.isDirectory(),
        mtimeMs: stat.mtimeMs,
        ctimeMs: stat.ctimeMs,
      };
      return { id, ok: true, summary: "Stat", details_b64: b64(JSON.stringify(payload)) };
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

      const stat = await fs.stat(absPath);
      if (stat.size > MAX_READSLICE_BYTES) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_FILE_TOO_LARGE", `file too large for fs.readSlice (${stat.size} bytes).`),
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

      const stat = await fs.stat(absPath);
      if (stat.size > MAX_SEARCH_BYTES) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_FILE_TOO_LARGE", `file too large for fs.search (${stat.size} bytes).`),
        };
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

    if (action === "fs.searchTree") {
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

      const stat = await fs.stat(absPath);
      const matches: Array<{ path: string; line: number; text: string }> = [];
      let filesScanned = 0;
      let filesSkipped = 0;
      let truncated = false;

      const searchFile = async (filePath: string) => {
        if (matches.length >= MAX_SEARCHTREE_MATCHES) {
          truncated = true;
          return;
        }
        const s = await fs.stat(filePath);
        if (s.isDirectory()) return;
        if (s.size > MAX_SEARCHTREE_BYTES) {
          filesSkipped += 1;
          return;
        }
        const data = await fs.readFile(filePath, "utf-8");
        const lines = data.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            matches.push({ path: toRelPath(filePath), line: i + 1, text: lines[i] });
            if (matches.length >= MAX_SEARCHTREE_MATCHES) {
              truncated = true;
              return;
            }
          }
        }
        filesScanned += 1;
      };

      const walkDir = async (dirPath: string) => {
        if (filesScanned >= MAX_SEARCHTREE_FILES || truncated) return;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (filesScanned >= MAX_SEARCHTREE_FILES || truncated) return;
          const full = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await walkDir(full);
          } else {
            await searchFile(full);
          }
        }
      };

      if (stat.isDirectory()) {
        await walkDir(absPath);
      } else {
        await searchFile(absPath);
      }

      const out: string[] = [];
      out.push(`# searchTree in ${relPath}`);
      out.push(`# query: ${query}`);
      out.push(`# matches: ${matches.length}${truncated ? " (truncated)" : ""}`);
      out.push(`# files scanned: ${filesScanned}${filesSkipped ? ` (skipped: ${filesSkipped})` : ""}`);
      out.push("");
      for (const m of matches) {
        const n = String(m.line).padStart(6, " ");
        out.push(`${m.path}:${n}: ${m.text}`);
      }

      return { id, ok: true, summary: `SearchTree found ${matches.length} matches`, details_b64: b64(out.join("\n")) };
    }

    if (action === "fs.listRegions") {
      const styleRes = resolveCommentStyle(cmd, relPath);
      if (!styleRes.ok) return { id, ok: false, summary: styleRes.summary };

      const data = await fs.readFile(absPath, "utf-8");
      const lines = data.split(/\r?\n/);
      const res = listRegions(lines, styleRes.style);
      if (!res.ok) return { id, ok: false, summary: res.summary };

      const payload = { regions: res.regions };
      return { id, ok: true, summary: `Listed ${res.regions.length} regions`, details_b64: b64(JSON.stringify(payload)) };
    }

    if (action === "fs.insertRegion") {
      const markerId = String((cmd as any).marker_id || "").trim();
      const anchor = String((cmd as any).anchor || "").trim();
      const position = typeof (cmd as any).position === "string" ? String((cmd as any).position).trim() : "after";
      const occurrence = Math.max(1, Number((cmd as any).occurrence ?? 1));
      if (!Number.isFinite(occurrence)) {
        return { id, ok: false, summary: invalidCmdSummary("ERR_INVALID_ANCHOR_OCCURRENCE", "occurrence must be a number.") };
      }
      if (position && position !== "before" && position !== "after") {
        return { id, ok: false, summary: invalidCmdSummary("ERR_INVALID_INSERT_POSITION", "position must be 'before' or 'after'.") };
      }

      const styleRes = resolveCommentStyle(cmd, relPath);
      if (!styleRes.ok) return { id, ok: false, summary: styleRes.summary };

      const data = await fs.readFile(absPath, "utf-8");
      const newline = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(/\r?\n/);
      const markerRegexes = buildMarkerRegexes(styleRes.style, markerId);
      const markerExists = lines.some((line) => markerRegexes.begin.test(line) || markerRegexes.end.test(line));
      if (markerExists) {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_REGION_MARKER_ALREADY_EXISTS", `marker_id=${markerId} already exists.`),
        };
      }

      let foundIndex = -1;
      let seen = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(anchor)) {
          seen += 1;
          if (seen === occurrence) {
            foundIndex = i;
            break;
          }
        }
      }
      if (foundIndex === -1) {
        return { id, ok: false, summary: invalidCmdSummary("ERR_ANCHOR_NOT_FOUND", "anchor text not found.") };
      }

      let content = "";
      try {
        content = Buffer.from(String((cmd as any).content_b64).trim(), "base64").toString("utf-8");
      } catch {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_BASE64", "field=content_b64 is not valid base64."),
        };
      }

      const markerLines = buildMarkerLines(styleRes.style, markerId);
      const contentLines = content === "" ? [] : content.split(/\r?\n/);
      const blockLines = [markerLines.begin, ...contentLines, markerLines.end];
      const insertAt = position === "before" ? foundIndex : foundIndex + 1;
      const newLines = lines.slice(0, insertAt).concat(blockLines, lines.slice(insertAt));
      const newText = newLines.join(newline);
      await fs.writeFile(absPath, newText, "utf-8");
      return { id, ok: true, summary: `Inserted region ${markerId}` };
    }

    if (action === "fs.readRegion") {
      const markerId = String((cmd as any).marker_id || "").trim();
      const styleRes = resolveCommentStyle(cmd, relPath);
      if (!styleRes.ok) return { id, ok: false, summary: styleRes.summary };

      const data = await fs.readFile(absPath, "utf-8");
      const newline = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(/\r?\n/);
      const region = findRegion(lines, styleRes.style, markerId);
      if (!region.ok) return { id, ok: false, summary: region.summary };

      const content = lines.slice(region.begin + 1, region.end).join(newline);
      return { id, ok: true, summary: `Read region ${markerId}`, details_b64: b64(content) };
    }

    if (action === "fs.replaceRegion") {
      const markerId = String((cmd as any).marker_id || "").trim();
      const styleRes = resolveCommentStyle(cmd, relPath);
      if (!styleRes.ok) return { id, ok: false, summary: styleRes.summary };

      const data = await fs.readFile(absPath, "utf-8");
      const newline = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(/\r?\n/);
      const region = findRegion(lines, styleRes.style, markerId);
      if (!region.ok) return { id, ok: false, summary: region.summary };

      let content = "";
      try {
        content = Buffer.from(String((cmd as any).content_b64).trim(), "base64").toString("utf-8");
      } catch {
        return {
          id,
          ok: false,
          summary: invalidCmdSummary("ERR_INVALID_BASE64", "field=content_b64 is not valid base64."),
        };
      }

      const contentLines = content === "" ? [] : content.split(/\r?\n/);
      const newLines = lines.slice(0, region.begin + 1).concat(contentLines, lines.slice(region.end));
      const newText = newLines.join(newline);
      await fs.writeFile(absPath, newText, "utf-8");
      return { id, ok: true, summary: `Replaced region ${markerId}` };
    }

    if (action === "fs.deleteRegion") {
      const markerId = String((cmd as any).marker_id || "").trim();
      const styleRes = resolveCommentStyle(cmd, relPath);
      if (!styleRes.ok) return { id, ok: false, summary: styleRes.summary };

      const data = await fs.readFile(absPath, "utf-8");
      const newline = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(/\r?\n/);
      const region = findRegion(lines, styleRes.style, markerId);
      if (!region.ok) return { id, ok: false, summary: region.summary };

      const newLines = lines.slice(0, region.begin + 1).concat(lines.slice(region.end));
      const newText = newLines.join(newline);
      await fs.writeFile(absPath, newText, "utf-8");
      return { id, ok: true, summary: `Deleted region ${markerId}` };
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


    if (action === "fs.copy") {
      await fs.mkdir(path.dirname(absPathTo!), { recursive: true });
      await copyPath(absPath, absPathTo!);
      return { id, ok: true, summary: "Copied" };
    }

    if (action === "fs.move" || action === "fs.rename") {
      await fs.mkdir(path.dirname(absPathTo!), { recursive: true });
      try {
        await fs.rename(absPath, absPathTo!);
      } catch (err: any) {
        if (err?.code === "EXDEV") {
          await copyPath(absPath, absPathTo!);
          await fs.rm(absPath, { recursive: true, force: true });
        } else {
          throw err;
        }
      }
      return { id, ok: true, summary: action === "fs.rename" ? "Renamed" : "Moved" };
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

async function createWindow() {
  app.setName(APP_NAME);

  const userProfiles = await loadUserProfiles();
  const userAppearances = await loadUserAppearances();
  const storedAppearanceId = await loadAppearanceId();
  recentWorkspaces = await loadRecentWorkspaces();
  currentProfiles = userProfiles && userProfiles.length
    ? Object.fromEntries(userProfiles.map((p) => [p.id, p]))
    : { ...LLM_PROFILES };
  currentAppearances = userAppearances && userAppearances.length
    ? userAppearances
    : [...DEFAULT_APPEARANCES];

  let activeProfileId = INITIAL_LLM_ID;
  if (!isLlmId(activeProfileId)) {
    activeProfileId = (currentProfiles[DEFAULT_LLM_ID] ? DEFAULT_LLM_ID : Object.keys(currentProfiles)[0]) as LLMId;
  }
  let startUrlOverride: string | null = START_URL_OVERRIDE;
  let activeAppearanceId = currentAppearances[0]?.id ?? "operator-classic";
  if (storedAppearanceId && currentAppearances.some((a) => a.id === storedAppearanceId)) {
    activeAppearanceId = storedAppearanceId;
  }
  let activeProfile = getProfile(activeProfileId);

  allowedHosts = buildAllowedHosts(activeProfile, startUrlOverride);

  const SIDEBAR_WIDTH = 360;
  const TOPBAR_HEIGHT = 44;
  const TOAST_WIDTH = 360;
  const TOAST_HEIGHT = 200;

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

  // Host window (no UI content)
  win.loadFile(path.join(app.getAppPath(), "renderer", "host.html")).catch(() => { });

  const sidebarView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const topbarView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const chatView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // no preload here
    },
  });

  const overlayView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const toastView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.addBrowserView(sidebarView);
  win.addBrowserView(topbarView);
  win.addBrowserView(chatView);
  win.addBrowserView(toastView);
  win.addBrowserView(overlayView);

  function broadcastWorkspaceChanged() {
    const payload = { workspaceRoot };
    topbarView.webContents.send("operator:workspaceChanged", payload);
    sidebarView.webContents.send("operator:workspaceChanged", payload);
  }

  function broadcastLlmProfilesChanged() {
    const profiles = Object.values(currentProfiles);
    const payload = { profiles, activeId: activeProfileId };
    topbarView.webContents.send("operator:llmProfilesChanged", payload);
    sidebarView.webContents.send("operator:llmProfilesChanged", payload);
  }

  function broadcastAppearanceChanged() {
    const appearance = currentAppearances.find((a) => a.id === activeAppearanceId) ?? currentAppearances[0];
    if (!appearance) return;
    const payload = { id: appearance.id, label: appearance.label, vars: appearance.vars };
    topbarView.webContents.send("operator:appearanceChanged", payload);
    sidebarView.webContents.send("operator:appearanceChanged", payload);
    overlayView.webContents.send("operator:appearanceChanged", payload);
    toastView.webContents.send("operator:appearanceChanged", payload);
  }

  function broadcastAppearanceVars(vars: Record<string, string>) {
    const payload = { id: "preview", vars };
    topbarView.webContents.send("operator:appearanceChanged", payload);
    sidebarView.webContents.send("operator:appearanceChanged", payload);
    overlayView.webContents.send("operator:appearanceChanged", payload);
    toastView.webContents.send("operator:appearanceChanged", payload);
  }

  function applyProfiles(list: LLMProfile[]) {
    if (!list.length) {
      currentProfiles = { ...LLM_PROFILES };
    } else {
      currentProfiles = Object.fromEntries(list.map((p) => [p.id, p]));
    }
    if (!isLlmId(activeProfileId)) {
      activeProfileId = (currentProfiles[DEFAULT_LLM_ID] ? DEFAULT_LLM_ID : Object.keys(currentProfiles)[0]) as LLMId;
    }
    activeProfile = getProfile(activeProfileId);
    allowedHosts = buildAllowedHosts(activeProfile, startUrlOverride);
    chatView.webContents.loadURL(activeProfile.startUrl);
    broadcastLlmProfilesChanged();
  }

  async function setAppearance(id: string) {
    const next = currentAppearances.find((a) => a.id === id) ? id : currentAppearances[0]?.id;
    if (!next) return;
    activeAppearanceId = next;
    previewAppearanceVars = null;
    await saveAppearanceId(activeAppearanceId);
    broadcastAppearanceChanged();
  }

  async function applyWorkspace(candidate: string): Promise<{ ok: boolean; error?: string }> {
    const raw = typeof candidate === "string" ? candidate.trim() : "";
    if (!raw) return { ok: false, error: "Workspace path is empty" };
    try {
      const resolved = path.resolve(raw);
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        return { ok: false, error: "Workspace path is not a directory" };
      }
      workspaceRoot = resolved;
      addRecentWorkspace(resolved);
      broadcastWorkspaceChanged();
      buildWorkspaceMenu();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  }

  async function closeWorkspace() {
    workspaceRoot = null;
    broadcastWorkspaceChanged();
    buildWorkspaceMenu();
  }

  function buildWorkspaceMenu() {
    // Custom in-app menu is used instead of native Electron menu.
    Menu.setApplicationMenu(null);
  }

  function setActiveProfile(id: LLMId) {
    activeProfileId = id;
    activeProfile = getProfile(activeProfileId);
    startUrlOverride = null;
    allowedHosts = buildAllowedHosts(activeProfile, null);
    chatView.webContents.loadURL(activeProfile.startUrl);
  }

  let sidebarWidth = SIDEBAR_WIDTH;
  let resizeTimer: NodeJS.Timeout | null = null;
  let pendingSidebarWidth: number | null = null;

  let overlayVisible = false;
  let menuVisible = false;
  let toastVisible = false;
  let toastSize = { width: TOAST_WIDTH, height: TOAST_HEIGHT };

  function applyToastBounds() {
    const [w, h] = win.getContentSize();
    if (!toastVisible) {
      toastView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    const toastWidth = Math.min(toastSize.width, Math.max(0, w - SIDEBAR_WIDTH));
    const toastHeight = Math.min(toastSize.height, Math.max(0, h - TOPBAR_HEIGHT));
    const x = SIDEBAR_WIDTH + Math.max(0, w - SIDEBAR_WIDTH - toastWidth);
    const y = TOPBAR_HEIGHT + Math.max(0, h - TOPBAR_HEIGHT - toastHeight);
    toastView.setBounds({ x, y, width: toastWidth, height: toastHeight });
  }

  function applyOverlayBounds() {
    const [w, h] = win.getContentSize();
    if (!overlayVisible && !menuVisible) {
      overlayView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    overlayView.setBounds({ x: 0, y: 0, width: w, height: h });
  }

  function openOverlay(kind: "getting-started" | "llm-profiles" | "appearance") {
    overlayVisible = true;
    applyOverlayBounds();
    if (kind === "getting-started") {
      overlayView.webContents.send("operator:openGettingStarted");
      overlayView.webContents.executeJavaScript("window.__openGettingStarted && window.__openGettingStarted()").catch(() => {});
    } else if (kind === "appearance") {
      overlayView.webContents.send("operator:openAppearance");
      overlayView.webContents.executeJavaScript("window.__openAppearance && window.__openAppearance()").catch(() => {});
    } else {
      overlayView.webContents.send("operator:openLlmProfiles");
      overlayView.webContents.executeJavaScript("window.__openLlmProfiles && window.__openLlmProfiles()").catch(() => {});
    }
  }

  function layout() {
    if (win.isDestroyed()) return;
    if (sidebarView.webContents.isDestroyed() || topbarView.webContents.isDestroyed() || chatView.webContents.isDestroyed()) return;
    const [w, h] = win.getContentSize();
    const SIDEBAR_WIDTH = sidebarWidth;
    const TOPBAR_HEIGHT = 44;
    try {
      sidebarView.setBounds({
        x: 0,
        y: 0,
        width: SIDEBAR_WIDTH,
        height: h,
      });
      topbarView.setBounds({
        x: SIDEBAR_WIDTH,
        y: 0,
        width: Math.max(0, w - SIDEBAR_WIDTH),
        height: TOPBAR_HEIGHT,
      });
      chatView.setBounds({
        x: SIDEBAR_WIDTH,
        y: TOPBAR_HEIGHT,
        width: Math.max(0, w - SIDEBAR_WIDTH),
        height: Math.max(0, h - TOPBAR_HEIGHT),
      });
      sidebarView.setAutoResize({ height: true });
      topbarView.setAutoResize({ width: true });
      chatView.setAutoResize({ width: true, height: true });
      toastView.setAutoResize({ width: true, height: true });
      overlayView.setAutoResize({ width: true, height: true });
      applyToastBounds();
      applyOverlayBounds();
    } catch {
      // ignore layout errors during teardown/restart
    }
    // debug logging removed
  }

  function setSidebarWidth(width: number) {
    if (win.isDestroyed()) return sidebarWidth;
    const next = Math.max(260, Math.min(720, Math.floor(Number(width) || SIDEBAR_WIDTH)));
    pendingSidebarWidth = next;
    if (!resizeTimer) {
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (pendingSidebarWidth === null) return;
        if (win.isDestroyed()) return;
        const value = pendingSidebarWidth;
        pendingSidebarWidth = null;
        if (value !== sidebarWidth) {
          sidebarWidth = value;
          layout();
        }
      }, 40);
    }
    return next;
  }

  layout();
  buildWorkspaceMenu();
  broadcastAppearanceChanged();
  win.on("resize", layout);

  // Harden the UI views and webchat view
  hardenWebContents(sidebarView.webContents);
  hardenWebContents(topbarView.webContents);
  hardenWebContents(chatView.webContents);
  hardenWebContents(toastView.webContents);
  hardenWebContents(overlayView.webContents);

  // Load Operator UI views
  sidebarView.webContents.loadFile(path.join(app.getAppPath(), "renderer", "index.html")).catch(() => { });
  topbarView.webContents.loadFile(path.join(app.getAppPath(), "renderer", "topbar.html")).catch(() => { });
  overlayView.webContents.loadFile(path.join(app.getAppPath(), "renderer", "overlay.html")).catch(() => { });
  toastView.webContents.loadFile(path.join(app.getAppPath(), "renderer", "toast.html")).catch(() => { });

  // Load webchat
  const startUrl = startUrlOverride ?? activeProfile.startUrl;
  chatView.webContents.loadURL(startUrl);

  // ---- IPC handlers ----

  ipcMain.handle("operator:getWorkspace", async () => {
    return { workspaceRoot };
  });

  ipcMain.handle("operator:getRecentWorkspaces", async () => {
    return { recentWorkspaces: [...recentWorkspaces] };
  });

  ipcMain.handle("operator:closeWorkspace", async () => {
    await closeWorkspace();
    return { ok: true, workspaceRoot };
  });

  ipcMain.handle("operator:setWorkspace", async (_evt, { path: candidate }: { path: string }) => {
    const res = await applyWorkspace(candidate);
    return res.ok ? { ok: true, workspaceRoot } : { ok: false, workspaceRoot, error: res.error };
  });

  ipcMain.handle("operator:setSidebarWidth", async (_evt, { width }: { width: number }) => {
    const next = setSidebarWidth(width);
    return { ok: true, width: next };
  });

  ipcMain.handle("operator:openGettingStarted", async () => {
    openOverlay("getting-started");
    return { ok: true };
  });

  ipcMain.handle("operator:closeGettingStarted", async () => {
    overlayVisible = false;
    applyOverlayBounds();
    return { ok: true };
  });

  ipcMain.handle("operator:openLlmProfiles", async () => {
    openOverlay("llm-profiles");
    return { ok: true };
  });

  ipcMain.handle("operator:closeLlmProfiles", async () => {
    overlayVisible = false;
    applyOverlayBounds();
    return { ok: true };
  });

  ipcMain.handle("operator:openAppearance", async () => {
    openOverlay("appearance");
    return { ok: true };
  });

  ipcMain.handle("operator:closeAppearance", async () => {
    overlayVisible = false;
    applyOverlayBounds();
    return { ok: true };
  });

  ipcMain.handle("operator:openMenu", async (_evt, payload: { menu: "workspace" | "settings" | "help"; rect: { left: number; right: number; top: number; bottom: number } }) => {
    menuVisible = true;
    applyOverlayBounds();
    const rect = payload?.rect;
    const adjusted = rect
      ? {
        left: rect.left + sidebarWidth,
        right: rect.right + sidebarWidth,
        top: rect.top,
        bottom: rect.bottom,
      }
      : rect;
    overlayView.webContents.send("operator:openMenu", { ...payload, rect: adjusted });
    return { ok: true };
  });

  ipcMain.handle("operator:closeMenu", async () => {
    menuVisible = false;
    applyOverlayBounds();
    overlayView.webContents.send("operator:closeMenu");
    return { ok: true };
  });

  ipcMain.handle("operator:showToast", async (_evt, payload: { message: string; kind?: string }) => {
    toastVisible = true;
    applyToastBounds();
    toastView.webContents.send("operator:toast", payload);
    return { ok: true };
  });

  ipcMain.handle("operator:hideToast", async () => {
    toastVisible = false;
    applyToastBounds();
    return { ok: true };
  });

  ipcMain.handle("operator:setToastSize", async (_evt, payload: { width: number; height: number }) => {
    const w = Math.max(180, Math.min(420, Math.floor(payload.width || TOAST_WIDTH)));
    const h = Math.max(60, Math.min(420, Math.floor(payload.height || TOAST_HEIGHT)));
    toastSize = { width: w, height: h };
    if (toastVisible) applyToastBounds();
    return { ok: true };
  });

  ipcMain.handle("operator:chooseWorkspace", async () => {
    const res = await dialog.showOpenDialog(win, {
      title: "Choose workspace root",
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, workspaceRoot };
    const applyRes = await applyWorkspace(res.filePaths[0]);
    return applyRes.ok ? { ok: true, workspaceRoot } : { ok: false, workspaceRoot, error: applyRes.error };
  });

  ipcMain.handle("operator:copy", async (_evt, { text }: { text: string }) => {
    clipboard.writeText(String(text ?? ""));
    return { ok: true };
  });

  ipcMain.handle("operator:getLlmProfiles", async () => {
    const profiles = Object.values(currentProfiles).map((p) => ({
      id: p.id,
      label: p.label,
      startUrl: p.startUrl,
      allowedHosts: p.allowedHosts,
    }));
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

  ipcMain.handle("operator:getAppearances", async () => {
    const list = currentAppearances.map((a) => ({ id: a.id, label: a.label, vars: a.vars }));
    return { appearances: list, activeId: activeAppearanceId };
  });

  ipcMain.handle("operator:getActiveAppearance", async () => {
    const appearance = currentAppearances.find((a) => a.id === activeAppearanceId) ?? currentAppearances[0];
    if (!appearance) return { id: "operator-classic" };
    return { id: appearance.id, label: appearance.label, vars: appearance.vars };
  });

  ipcMain.handle("operator:setAppearance", async (_evt, { id }: { id: string }) => {
    const exists = currentAppearances.find((a) => a.id === id);
    if (!exists) return { ok: false, error: "Unknown appearance" };
    await setAppearance(id);
    return { ok: true, id: activeAppearanceId };
  });

  ipcMain.handle("operator:previewAppearance", async (_evt, { vars }: { vars: Record<string, string> }) => {
    if (!vars || typeof vars !== "object") return { ok: false, error: "Invalid vars" };
    previewAppearanceVars = vars;
    broadcastAppearanceVars(vars);
    return { ok: true };
  });

  ipcMain.handle("operator:clearAppearancePreview", async () => {
    previewAppearanceVars = null;
    broadcastAppearanceChanged();
    return { ok: true };
  });

  ipcMain.handle("operator:setAppearances", async (_evt, { appearances }: { appearances: any[] }) => {
    const list = Array.isArray(appearances) ? appearances : [];
    const sanitized = list.map(sanitizeAppearance).filter(Boolean) as Appearance[];
    if (!sanitized.length) return { ok: false, error: "No valid appearances provided." };
    const unique = new Map<string, Appearance>();
    for (const appearance of sanitized) unique.set(appearance.id, appearance);
    currentAppearances = Array.from(unique.values());
    if (!currentAppearances.find((a) => a.id === activeAppearanceId)) {
      activeAppearanceId = currentAppearances[0]?.id ?? "operator-classic";
    }
    try {
      await saveUserAppearances(currentAppearances);
      await saveAppearanceId(activeAppearanceId);
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
    broadcastAppearanceChanged();
    return { ok: true };
  });

  ipcMain.handle("operator:resetAppearances", async () => {
    await resetUserAppearances();
    currentAppearances = [...DEFAULT_APPEARANCES];
    activeAppearanceId = currentAppearances[0]?.id ?? "operator-classic";
    await saveAppearanceId(activeAppearanceId);
    broadcastAppearanceChanged();
    return { ok: true };
  });

  ipcMain.handle("operator:setLlmProfiles", async (_evt, { profiles }: { profiles: any[] }) => {
    const list = Array.isArray(profiles) ? profiles : [];
    const sanitized = list.map(sanitizeProfile).filter(Boolean) as LLMProfile[];
    if (!sanitized.length) {
      return { ok: false, error: "No valid profiles provided." };
    }
    const unique = new Map<string, LLMProfile>();
    for (const profile of sanitized) {
      unique.set(profile.id, profile);
    }
    const deduped = Array.from(unique.values());
    applyProfiles(deduped);
    try {
      await saveUserProfiles(deduped);
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
    return { ok: true };
  });

  ipcMain.handle("operator:resetLlmProfiles", async () => {
    await resetUserProfiles();
    applyProfiles(Object.values(LLM_PROFILES));
    return { ok: true };
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
    const result = await chatView.webContents.executeJavaScript(extractorCode, true);
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
    const { commands, errors } = scanForCommands(scanText);
    if (trimmed) {
      errors.unshift(`Scan input trimmed to last ${EXTRACT_LIMIT_CHARS} chars.`);
    }
    // Duplicate command id handling happens in scanForCommands (ERR_DUPLICATE_ID).
    return { commands, errors };
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

    if (action === "operator.getCommentStyle") {
      const language = typeof cmd?.language === "string" ? cmd.language.trim() : "";
      if (language) {
        const style = getCommentStyleForLanguage(language);
        if (!style) {
          const r: OperatorResult = {
            id,
            ok: false,
            summary: invalidCmdSummary("ERR_UNKNOWN_LANGUAGE", `unknown language '${language}'`),
          };
          return { result: r, resultText: formatOperatorResult(r) };
        }
        const payload = style.type === "line"
          ? { language: style.language, type: "line", line_prefix: style.linePrefix }
          : { language: style.language, type: "block", block_start: style.blockStart, block_end: style.blockEnd };
        const body = { requested: language, styles: [payload] };
        const r: OperatorResult = { id, ok: true, summary: "Comment style", details_b64: b64(JSON.stringify(body)) };
        return { result: r, resultText: formatOperatorResult(r) };
      }

      const styles = Object.values(COMMENT_STYLE_MAP)
        .map((s) => {
          if (s.type === "line") return { language: s.language, type: "line", line_prefix: s.linePrefix };
          return { language: s.language, type: "block", block_start: s.blockStart, block_end: s.blockEnd };
        })
        .sort((a, b) => a.language.localeCompare(b.language));
      const r: OperatorResult = { id, ok: true, summary: "Comment style list", details_b64: b64(JSON.stringify({ styles })) };
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
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
