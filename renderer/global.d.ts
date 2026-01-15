// renderer/global.d.ts
export {};

declare global {
  interface Window {
    operator: {
      extract: () => Promise<{ text: string; meta: any }>;
      scan: (text: string) => Promise<{ commands: any[]; warnings: string[] }>;
      execute: (cmd: any) => Promise<{ result: any; resultText: string }>;
      chooseWorkspace: () => Promise<{ ok: boolean; workspaceRoot: string | null }>;
      getWorkspace: () => Promise<{ workspaceRoot: string | null }>;
      copyToClipboard: (text: string) => Promise<{ ok: boolean }>;
    };
  }
}
