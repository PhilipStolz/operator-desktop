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
      readClipboard: () => Promise<{ text: string }>;
      getBootstrapPrompt: () => Promise<{
        ok: boolean;
        text: string;
        profileId?: string;
        profileLabel?: string;
        error?: string;
      }>;
      getSmokeTestPrompt: () => Promise<{ ok: boolean; text: string; error?: string }>;
      getLlmProfiles: () => Promise<{ profiles: Array<{ id: string; label: string }> }>;
      getActiveLlmProfile: () => Promise<{ id: string; label: string }>;
      setLlmProfile: (id: string) => Promise<{ ok: boolean; id?: string; label?: string; error?: string }>;
    };
  }
}
