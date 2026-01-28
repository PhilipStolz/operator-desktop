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
  closeGettingStarted: () => ipcRenderer.invoke("operator:closeGettingStarted"),

});

export {};
