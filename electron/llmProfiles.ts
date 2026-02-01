// electron/llmProfiles.ts

export type LLMId = string;

export type LLMProfile = {
  id: LLMId;
  label: string;
  startUrl: string;
  allowedHosts: string[];
  bootstrapPromptFile: string;
};

export const DEFAULT_LLM_ID: LLMId = "lechat";

// NOTE: This app embeds web UI (BrowserView). We do NOT use provider APIs here.
export const LLM_PROFILES: Record<string, LLMProfile> = {
  lechat: {
    id: "lechat",
    label: "LeChat",
    startUrl: "https://chat.mistral.ai/",
    allowedHosts: ["chat.mistral.ai", "v2.auth.mistral.ai", "auth.mistral.ai", "mistral.ai"],
    bootstrapPromptFile: "operator_llm_bootstrap.txt",
  },
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    startUrl: "https://chat.openai.com/",
    allowedHosts: ["chat.openai.com", "chatgpt.com", "auth.openai.com", "openai.com"],
    bootstrapPromptFile: "operator_llm_bootstrap.txt",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    startUrl: "https://chat.deepseek.com/",
    allowedHosts: ["chat.deepseek.com"],
    bootstrapPromptFile: "operator_llm_bootstrap.txt",
  },
};
