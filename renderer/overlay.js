const gettingOverlay = document.getElementById("gettingStartedOverlay");
const btnClose = document.getElementById("gettingStartedClose");
const btnCloseFooter = document.getElementById("gettingStartedCloseFooter");

const llmOverlay = document.getElementById("llmProfilesOverlay");
const llmClose = document.getElementById("llmClose");
const llmCancel = document.getElementById("llmCancel");
const llmSave = document.getElementById("llmSave");
const llmAdd = document.getElementById("llmAdd");
const llmReset = document.getElementById("llmReset");
const llmProfilesBody = document.getElementById("llmProfilesBody");
const appearanceOverlay = document.getElementById("appearanceOverlay");
const appearanceList = document.getElementById("appearanceList");
const appearanceClose = document.getElementById("appearanceClose");
const appearanceCancel = document.getElementById("appearanceCancel");
const appearanceSave = document.getElementById("appearanceSave");
const appearanceAdd = document.getElementById("appearanceAdd");
const appearanceRemove = document.getElementById("appearanceRemove");
const appearanceReset = document.getElementById("appearanceReset");
const appearanceId = document.getElementById("appearanceId");
const appearanceLabel = document.getElementById("appearanceLabel");
const appearanceAppBg = document.getElementById("appearanceAppBg");
const appearancePanelBg = document.getElementById("appearancePanelBg");
const appearancePanelAlt = document.getElementById("appearancePanelAlt");
const appearanceText = document.getElementById("appearanceText");
const appearanceTextMuted = document.getElementById("appearanceTextMuted");
const appearanceBorder = document.getElementById("appearanceBorder");
const appearanceAccent = document.getElementById("appearanceAccent");
const appearanceAccentMuted = document.getElementById("appearanceAccentMuted");

let activeOverlay = null;
let llmOpenSeq = 0;
let selectedAppearanceId = null;
let appearanceOpenSeq = 0;
let appearanceOriginalId = null;
let appearanceDrafts = [];

function setOverlayState(el, open) {
  if (!el) return;
  el.classList.toggle("open", !!open);
  el.setAttribute("aria-hidden", open ? "false" : "true");
}

function applyAppearanceVars(payload) {
  const vars = payload?.vars;
  if (!vars) return;
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, String(value));
  }
}

function toHex(value, fallback) {
  const v = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function readColor(input, fallback) {
  if (!input) return fallback;
  return toHex(input.value, fallback);
}

function setInputValue(input, value) {
  if (!input) return;
  input.value = value || "";
}

function findDraft(id) {
  return appearanceDrafts.find((a) => a.id === id);
}

function applyDraftToInputs(draft) {
  if (!draft) return;
  setInputValue(appearanceId, draft.id);
  setInputValue(appearanceLabel, draft.label);
  const vars = draft.vars || {};
  setInputValue(appearanceAppBg, toHex(vars["--app-bg"], "#e7edf4"));
  setInputValue(appearancePanelBg, toHex(vars["--panel-bg"], "#f9fbfe"));
  setInputValue(appearancePanelAlt, toHex(vars["--panel-bg-alt"], "#eef3f8"));
  setInputValue(appearanceText, toHex(vars["--text"], "#1b2430"));
  setInputValue(appearanceTextMuted, toHex(vars["--text-muted"], "#5a6778"));
  setInputValue(appearanceBorder, toHex(vars["--border"], "#c9d3df"));
  setInputValue(appearanceAccent, toHex(vars["--accent"], "#1a5fbf"));
  setInputValue(appearanceAccentMuted, toHex(vars["--accent-muted"], "#d9e6f7"));
}

function readInputsToDraft(draft) {
  if (!draft) return;
  const id = appearanceId?.value.trim();
  const label = appearanceLabel?.value.trim();
  if (id) draft.id = id;
  draft.label = label || draft.id;
  draft.vars = {
    "--app-bg": readColor(appearanceAppBg, "#e7edf4"),
    "--panel-bg": readColor(appearancePanelBg, "#f9fbfe"),
    "--panel-bg-alt": readColor(appearancePanelAlt, "#eef3f8"),
    "--text": readColor(appearanceText, "#1b2430"),
    "--text-muted": readColor(appearanceTextMuted, "#5a6778"),
    "--border": readColor(appearanceBorder, "#c9d3df"),
    "--accent": readColor(appearanceAccent, "#1a5fbf"),
    "--accent-muted": readColor(appearanceAccentMuted, "#d9e6f7"),
  };
}

function applyDraftPreview(draft) {
  if (!draft) return;
  applyAppearanceVars({ vars: draft.vars });
}

function attachAppearanceInputHandlers() {
  const inputs = [
    appearanceId,
    appearanceLabel,
    appearanceAppBg,
    appearancePanelBg,
    appearancePanelAlt,
    appearanceText,
    appearanceTextMuted,
    appearanceBorder,
    appearanceAccent,
    appearanceAccentMuted,
  ].filter(Boolean);
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      const draft = findDraft(selectedAppearanceId);
      if (!draft) return;
      readInputsToDraft(draft);
      applyDraftPreview(draft);
    });
  });
}

function openGettingStarted() {
  activeOverlay = "getting";
  setOverlayState(gettingOverlay, true);
  setOverlayState(llmOverlay, false);
  setOverlayState(appearanceOverlay, false);
}

async function closeGettingStarted() {
  setOverlayState(gettingOverlay, false);
  if (activeOverlay === "getting") activeOverlay = null;
  try {
    await window.operator?.closeGettingStarted?.();
  } catch {}
}

function createLlmInput(value) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  return input;
}

function addLlmRow(profile) {
  if (!llmProfilesBody) return;
  const row = document.createElement("div");
  row.className = "llmRow";
  row.style.display = "contents";

  const idInput = createLlmInput(profile?.id || "");
  const labelInput = createLlmInput(profile?.label || "");
  const urlInput = createLlmInput(profile?.startUrl || "");
  const hostsInput = createLlmInput(
    Array.isArray(profile?.allowedHosts) ? profile.allowedHosts.join(", ") : ""
  );

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "x";
  removeBtn.title = "Remove";
  removeBtn.onclick = () => {
    if (row.parentElement) row.parentElement.removeChild(row);
  };

  row.appendChild(idInput);
  row.appendChild(labelInput);
  row.appendChild(urlInput);
  row.appendChild(hostsInput);
  row.appendChild(removeBtn);
  llmProfilesBody.appendChild(row);
}

async function openLlmProfiles() {
  const seq = ++llmOpenSeq;
  if (llmProfilesBody) llmProfilesBody.innerHTML = "";
  try {
    const res = await window.operator?.getLlmProfiles?.();
    const profiles = Array.isArray(res?.profiles) ? res.profiles : [];
    if (seq !== llmOpenSeq) return;
    if (llmProfilesBody) llmProfilesBody.innerHTML = "";
    if (profiles.length === 0) addLlmRow({});
    else profiles.forEach((p) => addLlmRow(p));
  } catch (e) {
    if (seq !== llmOpenSeq) return;
    if (llmProfilesBody) addLlmRow({});
  }
  activeOverlay = "llm";
  setOverlayState(llmOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(appearanceOverlay, false);
}

async function closeLlmProfiles() {
  setOverlayState(llmOverlay, false);
  if (activeOverlay === "llm") activeOverlay = null;
  try {
    await window.operator?.closeLlmProfiles?.();
  } catch {}
}

async function openAppearance() {
  const seq = ++appearanceOpenSeq;
  if (appearanceList) appearanceList.innerHTML = "";
  try {
    const res = await window.operator?.getAppearances?.();
    const list = Array.isArray(res?.appearances) ? res.appearances : [];
    const activeId = res?.activeId || null;
    appearanceOriginalId = activeId;
    appearanceDrafts = list.map((a) => ({ id: a.id, label: a.label, vars: { ...(a.vars || {}) } }));
    if (seq !== appearanceOpenSeq) return;
    if (appearanceList) appearanceList.innerHTML = "";
    selectedAppearanceId = activeId;
    for (const item of list) {
      const row = document.createElement("div");
      row.className = "appearanceItem";
      if (item.id === activeId) row.classList.add("selected");

      const meta = document.createElement("div");
      meta.className = "appearanceMeta";
      const label = document.createElement("div");
      label.className = "appearanceLabel";
      label.textContent = item.label || item.id;
      const sub = document.createElement("div");
      sub.className = "small";
      sub.textContent = item.id || "";
      meta.appendChild(label);
      meta.appendChild(sub);

      const left = document.createElement("div");
      left.className = "appearanceRow";
      left.appendChild(meta);

      row.onclick = async () => {
        const id = item.id;
        if (!id) return;
        const current = findDraft(id);
        if (current) applyDraftToInputs(current);
        selectedAppearanceId = id;
        const items = appearanceList ? appearanceList.querySelectorAll(".appearanceItem") : [];
        items.forEach((el) => el.classList.remove("selected"));
        row.classList.add("selected");
        try {
          await window.operator?.setAppearance?.(id);
        } catch {}
      };

      row.appendChild(left);
      if (appearanceList) appearanceList.appendChild(row);
    }
  } catch {}
  activeOverlay = "appearance";
  setOverlayState(appearanceOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  const draft = findDraft(selectedAppearanceId);
  if (draft) applyDraftToInputs(draft);
}

async function closeAppearance(revert) {
  setOverlayState(appearanceOverlay, false);
  if (activeOverlay === "appearance") activeOverlay = null;
  if (revert && appearanceOriginalId && appearanceOriginalId !== selectedAppearanceId) {
    try {
      await window.operator?.setAppearance?.(appearanceOriginalId);
    } catch {}
  }
  try {
    await window.operator?.closeAppearance?.();
  } catch {}
}

function collectLlmProfiles() {
  if (!llmProfilesBody) return [];
  const rows = Array.from(llmProfilesBody.querySelectorAll(".llmRow"));
  const profiles = [];
  for (const row of rows) {
    const inputs = row.querySelectorAll("input");
    const id = inputs[0]?.value.trim();
    const label = inputs[1]?.value.trim();
    const startUrl = inputs[2]?.value.trim();
    const hostsRaw = inputs[3]?.value || "";
    const allowedHosts = hostsRaw.split(",").map((h) => h.trim()).filter(Boolean);
    if (!id && !label && !startUrl) continue;
    profiles.push({
      id: id || label,
      label: label || id,
      startUrl,
      allowedHosts,
    });
  }
  return profiles;
}

function showToast(message, kind) {
  const text = String(message || "").trim();
  if (!text) return;
  window.operator?.showToast?.({ message: text, kind: kind || "info" }).catch(() => {});
}

if (btnClose) btnClose.onclick = () => closeGettingStarted();
if (btnCloseFooter) btnCloseFooter.onclick = () => closeGettingStarted();

if (llmClose) llmClose.onclick = () => closeLlmProfiles();
if (llmCancel) llmCancel.onclick = () => closeLlmProfiles();
if (llmAdd) llmAdd.onclick = () => addLlmRow({});
if (llmSave) {
  llmSave.onclick = async () => {
    const profiles = collectLlmProfiles();
    if (!profiles.length) {
      showToast("Add at least one profile before saving.", "error");
      return;
    }
    const ids = profiles.map((p) => p.id).filter(Boolean);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      showToast("Profile ids must be unique.", "error");
      return;
    }
    try {
      const res = await window.operator?.setLlmProfiles?.(profiles);
      if (res?.ok) {
        showToast("LLM profiles updated.");
        await closeLlmProfiles();
      } else {
        showToast(res?.error ? `Save failed: ${res.error}` : "Save failed.", "error");
      }
    } catch {}
  };
}

if (llmReset) {
  llmReset.onclick = async () => {
    try {
      const res = await window.operator?.resetLlmProfiles?.();
      if (res?.ok) {
        await openLlmProfiles();
        showToast("LLM profiles reset to defaults.");
      } else {
        showToast(res?.error ? `Reset failed: ${res.error}` : "Reset failed.", "error");
      }
    } catch {}
  };
}

if (appearanceClose) appearanceClose.onclick = () => closeAppearance(true);
if (appearanceCancel) appearanceCancel.onclick = () => closeAppearance(true);
if (appearanceSave) {
  appearanceSave.onclick = async () => {
    if (!selectedAppearanceId) return;
    const current = findDraft(selectedAppearanceId);
    if (current) readInputsToDraft(current);
    const ids = appearanceDrafts.map((a) => a.id).filter(Boolean);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      showToast("Appearance ids must be unique.", "error");
      return;
    }
    try {
      const res = await window.operator?.setAppearances?.(appearanceDrafts);
      if (res?.ok) {
        await window.operator?.setAppearance?.(selectedAppearanceId);
        await closeAppearance(false);
        showToast("Appearance updated.");
      } else {
        showToast(res?.error ? `Save failed: ${res.error}` : "Save failed.", "error");
      }
    } catch {}
  };
}

if (appearanceAdd) {
  appearanceAdd.onclick = () => {
    const id = `custom-${Date.now()}`;
    const draft = {
      id,
      label: "Custom",
      vars: {
        "--app-bg": "#e7edf4",
        "--panel-bg": "#f9fbfe",
        "--panel-bg-alt": "#eef3f8",
        "--text": "#1b2430",
        "--text-muted": "#5a6778",
        "--border": "#c9d3df",
        "--accent": "#1a5fbf",
        "--accent-muted": "#d9e6f7",
      },
    };
    appearanceDrafts.push(draft);
    selectedAppearanceId = id;
    openAppearance();
  };
}

if (appearanceRemove) {
  appearanceRemove.onclick = () => {
    if (!selectedAppearanceId) return;
    appearanceDrafts = appearanceDrafts.filter((a) => a.id !== selectedAppearanceId);
    selectedAppearanceId = appearanceDrafts[0]?.id || null;
    openAppearance();
  };
}

if (appearanceReset) {
  appearanceReset.onclick = async () => {
    try {
      const res = await window.operator?.resetAppearances?.();
      if (res?.ok) {
        await openAppearance();
        showToast("Appearances reset to defaults.");
      } else {
        showToast(res?.error ? `Reset failed: ${res.error}` : "Reset failed.", "error");
      }
    } catch {}
  };
}

if (gettingOverlay) {
  gettingOverlay.addEventListener("click", (ev) => {
    if (ev.target === gettingOverlay) closeGettingStarted();
  });
}

if (llmOverlay) {
  llmOverlay.addEventListener("click", (ev) => {
    if (ev.target === llmOverlay) closeLlmProfiles();
  });
}

if (appearanceOverlay) {
  appearanceOverlay.addEventListener("click", (ev) => {
    if (ev.target === appearanceOverlay) closeAppearance(true);
  });
}

window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (activeOverlay === "llm") closeLlmProfiles();
  else if (activeOverlay === "getting") closeGettingStarted();
  else if (activeOverlay === "appearance") closeAppearance(true);
});

if (window.operator?.onOpenGettingStarted) {
  window.operator.onOpenGettingStarted(() => {
    openGettingStarted();
  });
}

if (window.operator?.onOpenLlmProfiles) {
  window.operator.onOpenLlmProfiles(() => {
    openLlmProfiles();
  });
}

if (window.operator?.onOpenAppearance) {
  window.operator.onOpenAppearance(() => {
    openAppearance();
  });
}

if (window.operator?.onAppearanceChanged) {
  window.operator.onAppearanceChanged((payload) => {
    applyAppearanceVars(payload);
  });
}

if (window.operator?.getActiveAppearance) {
  window.operator.getActiveAppearance().then((res) => {
    applyAppearanceVars(res);
  }).catch(() => {});
}

window.__openGettingStarted = openGettingStarted;
window.__openLlmProfiles = openLlmProfiles;
window.__openAppearance = openAppearance;

attachAppearanceInputHandlers();
