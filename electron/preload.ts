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
  getWorkspace: () => ipcRenderer.invoke("operator:getWorkspace"),

  // Clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke("operator:copy", { text }),

  readClipboard: () => ipcRenderer.invoke("operator:readClipboard"),

  getBootstrapPrompt: () => ipcRenderer.invoke("operator:getBootstrapPrompt"),

});

export {};
