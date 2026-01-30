// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

type OperatorCmd = {
  version?: number;
  id?: string;
  action?: string;
  path?: string;
  [k: string]: any;
};

contextBridge.exposeInMainWorld("operator", {
  // Webchat -> Plain text extraction
  extract: () => ipcRenderer.invoke("operator:extract"),

  // Plain text -> commands
  scan: (text: string) => ipcRenderer.invoke("operator:scan", { text }),

  // Execute a validated command
  execute: (cmd: OperatorCmd) => ipcRenderer.invoke("operator:execute", { cmd }),

  // Workspace selection
  chooseWorkspace: () => ipcRenderer.invoke("operator:chooseWorkspace"),
  setWorkspace: (path: string) => ipcRenderer.invoke("operator:setWorkspace", { path }),
  getWorkspace: () => ipcRenderer.invoke("operator:getWorkspace"),

  // Clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke("operator:copy", { text }),

  readClipboard: () => ipcRenderer.invoke("operator:readClipboard"),

  // LLM profiles
  getLlmProfiles: () => ipcRenderer.invoke("operator:getLlmProfiles"),
  getActiveLlmProfile: () => ipcRenderer.invoke("operator:getActiveLlmProfile"),
  setLlmProfile: (id: string) => ipcRenderer.invoke("operator:setLlmProfile", { id }),

  getBootstrapPrompt: () => ipcRenderer.invoke("operator:getBootstrapPrompt"),
  getSmokeTestPrompt: () => ipcRenderer.invoke("operator:getSmokeTestPrompt"),
  setSidebarWidth: (width: number) => ipcRenderer.invoke("operator:setSidebarWidth", { width }),
  openGettingStarted: () => ipcRenderer.invoke("operator:openGettingStarted"),
  onOpenGettingStarted: (cb: () => void) => ipcRenderer.on("operator:openGettingStarted", () => cb()),
  onWorkspaceChanged: (cb: (workspaceRoot: string | null) => void) =>
    ipcRenderer.on("operator:workspaceChanged", (_evt, payload: { workspaceRoot: string | null }) => cb(payload.workspaceRoot)),
  onLlmProfilesChanged: (cb: (payload: { profiles: any[]; activeId?: string }) => void) =>
    ipcRenderer.on("operator:llmProfilesChanged", (_evt, payload: { profiles: any[]; activeId?: string }) => cb(payload)),
  onOpenLlmProfiles: (cb: () => void) => ipcRenderer.on("operator:openLlmProfiles", () => cb()),
  closeGettingStarted: () => ipcRenderer.invoke("operator:closeGettingStarted"),
  closeLlmProfiles: () => ipcRenderer.invoke("operator:closeLlmProfiles"),
  openAppearance: () => ipcRenderer.invoke("operator:openAppearance"),
  closeAppearance: () => ipcRenderer.invoke("operator:closeAppearance"),
  showToast: (payload: { message: string; kind?: string }) => ipcRenderer.invoke("operator:showToast", payload),
  onToast: (cb: (payload: { message: string; kind?: string }) => void) =>
    ipcRenderer.on("operator:toast", (_evt, payload: { message: string; kind?: string }) => cb(payload)),
  hideToast: () => ipcRenderer.invoke("operator:hideToast"),
  setToastSize: (payload: { width: number; height: number }) => ipcRenderer.invoke("operator:setToastSize", payload),
  setLlmProfiles: (profiles: any[]) => ipcRenderer.invoke("operator:setLlmProfiles", { profiles }),
  resetLlmProfiles: () => ipcRenderer.invoke("operator:resetLlmProfiles"),
  getAppearances: () => ipcRenderer.invoke("operator:getAppearances"),
  getActiveAppearance: () => ipcRenderer.invoke("operator:getActiveAppearance"),
  setAppearance: (id: string) => ipcRenderer.invoke("operator:setAppearance", { id }),
  setAppearances: (appearances: any[]) => ipcRenderer.invoke("operator:setAppearances", { appearances }),
  resetAppearances: () => ipcRenderer.invoke("operator:resetAppearances"),
  previewAppearance: (vars: Record<string, string>) => ipcRenderer.invoke("operator:previewAppearance", { vars }),
  clearAppearancePreview: () => ipcRenderer.invoke("operator:clearAppearancePreview"),
  onAppearanceChanged: (cb: (payload: { id: string; label?: string; vars?: Record<string, string> }) => void) =>
    ipcRenderer.on("operator:appearanceChanged", (_evt, payload: { id: string; label?: string; vars?: Record<string, string> }) => cb(payload)),
  onOpenAppearance: (cb: () => void) => ipcRenderer.on("operator:openAppearance", () => cb()),

});

export {};
