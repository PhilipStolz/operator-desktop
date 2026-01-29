const $ = (id) => document.getElementById(id);

const topbarWorkspaceEl = $("topbarWorkspace");
const btnWorkspace = $("btnWorkspace");
const llmProfileSelect = $("llmProfile");
const btnGettingStarted = $("btnGettingStarted");

const FALLBACK_LLM_PROFILES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "deepseek", label: "DeepSeek" },
];

function applyAppearanceVars(payload) {
  const vars = payload?.vars;
  if (!vars) return;
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, String(value));
  }
}

function setWorkspaceText(text) {
  if (!topbarWorkspaceEl) return;
  topbarWorkspaceEl.textContent = text || "Workspace: (not set)";
}

async function refreshWorkspace() {
  try {
    const res = await window.operator?.getWorkspace?.();
    const root = res?.workspaceRoot;
    setWorkspaceText(root ? `Workspace: ${root}` : "Workspace: (not set)");
  } catch {
    setWorkspaceText("Workspace: (unknown)");
  }
}

async function loadLlmProfiles() {
  if (!llmProfileSelect) return;
  if (!window.operator?.getLlmProfiles) {
    llmProfileSelect.innerHTML = "";
    for (const profile of FALLBACK_LLM_PROFILES) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label || profile.id;
      llmProfileSelect.appendChild(option);
    }
    return;
  }
  try {
    const res = await window.operator.getLlmProfiles();
    const profiles = Array.isArray(res?.profiles) ? res.profiles : [];
    llmProfileSelect.innerHTML = "";
    for (const profile of profiles) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label || profile.id;
      llmProfileSelect.appendChild(option);
    }
    const active = await window.operator.getActiveLlmProfile?.();
    if (active?.id) llmProfileSelect.value = active.id;
    if (profiles.length === 0) {
      for (const profile of FALLBACK_LLM_PROFILES) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.label || profile.id;
        llmProfileSelect.appendChild(option);
      }
      llmProfileSelect.value = FALLBACK_LLM_PROFILES[0]?.id ?? "";
    }
  } catch {
    llmProfileSelect.innerHTML = "";
    for (const profile of FALLBACK_LLM_PROFILES) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label || profile.id;
      llmProfileSelect.appendChild(option);
    }
  }
}

if (btnWorkspace) {
  btnWorkspace.onclick = async () => {
    await window.operator?.chooseWorkspace?.();
    await refreshWorkspace();
  };
}

if (llmProfileSelect) {
  llmProfileSelect.onchange = async () => {
    const id = llmProfileSelect.value;
    if (!id) return;
    try {
      await window.operator?.setLlmProfile?.(id);
    } catch {}
  };
}

if (btnGettingStarted) {
  btnGettingStarted.onclick = async () => {
    try {
      await window.operator?.openGettingStarted?.();
    } catch {}
  };
}

window.addEventListener("DOMContentLoaded", async () => {
  await refreshWorkspace();
  await loadLlmProfiles();
  if (window.operator?.getActiveAppearance) {
    try {
      const res = await window.operator.getActiveAppearance();
      applyAppearanceVars(res);
    } catch {}
  }
});

if (window.operator?.onWorkspaceChanged) {
  window.operator.onWorkspaceChanged((workspaceRoot) => {
    setWorkspaceText(workspaceRoot ? `Workspace: ${workspaceRoot}` : "Workspace: (not set)");
  });
}

if (window.operator?.onAppearanceChanged) {
  window.operator.onAppearanceChanged((payload) => {
    applyAppearanceVars(payload);
  });
}
if (window.operator?.onLlmProfilesChanged) {
  window.operator.onLlmProfilesChanged(() => {
    loadLlmProfiles();
  });
}
