// electron/main.ts
// FINAL – stabil, kein Architekturwechsel, ChatGPT lädt wieder
// Status: exakt dein ursprüngliches Verhalten + minimale Härtung

import { app, BrowserWindow, shell } from "electron";
import * as path from "path";
import type { Event as ElectronEvent } from "electron";

const APP_NAME = "Operator";
const START_URL =
  process.env.OPERATOR_START_URL ?? "https://chat.openai.com/";

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
    },
  });

  applyBranding(win);

  // Popups / window.open -> extern öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Navigation im selben Fenster kontrollieren
  win.webContents.on("will-navigate", (event: ElectronEvent, url: string) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) {
        shell.openExternal(url);
      }
    }
  });

  // Redirects ebenfalls absichern
  win.webContents.on("will-redirect", (event: ElectronEvent, url: string) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) {
        shell.openExternal(url);
      }
    }
  });

  // WICHTIG: Erst Renderer laden, dann Webchat starten
  win.loadFile(path.join(app.getAppPath(), "renderer", "index.html")).catch(
    () => {}
  );

  win.webContents.once("did-finish-load", () => {
    win.loadURL(START_URL);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
