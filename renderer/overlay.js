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
const appearanceEditorOverlay = document.getElementById("appearanceEditorOverlay");
const appearanceList = document.getElementById("appearanceList");
const appearanceClose = document.getElementById("appearanceClose");
const appearanceCancel = document.getElementById("appearanceCancel");
const appearanceSave = document.getElementById("appearanceSave");
const appearanceAdd = document.getElementById("appearanceAdd");
const appearanceRemove = document.getElementById("appearanceRemove");
const appearanceReset = document.getElementById("appearanceReset");
const appearanceEditorClose = document.getElementById("appearanceEditorClose");
const appearanceEditorCancel = document.getElementById("appearanceEditorCancel");
const appearanceEditorSave = document.getElementById("appearanceEditorSave");
const appearanceEditorCopy = document.getElementById("appearanceEditorCopy");
const appearanceEditorPaste = document.getElementById("appearanceEditorPaste");
const appearanceId = document.getElementById("appearanceId");
const appearanceLabel = document.getElementById("appearanceLabel");
const appearanceSwatchGrid = document.getElementById("appearanceSwatchGrid");
const appearanceEditorPreview = document.getElementById("appearanceEditorPreview");

let activeOverlay = null;
let llmOpenSeq = 0;
let selectedAppearanceId = null;
let appearanceOpenSeq = 0;
let appearanceOriginalId = null;
let appearanceDrafts = [];
let editingAppearanceId = null;
let autoIdEnabled = true;
let appearanceEditSnapshot = null;

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatAlpha(alpha) {
  const rounded = Math.round(alpha * 100) / 100;
  const text = String(rounded.toFixed(2));
  return text.replace(/\.?0+$/, "");
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const lig = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function parseColor(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  let match = text.match(/^rgba?\((.+)\)$/i);
  if (match) {
    const parts = match[1].split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const r = clamp(parseFloat(parts[0]), 0, 255);
      const g = clamp(parseFloat(parts[1]), 0, 255);
      const b = clamp(parseFloat(parts[2]), 0, 255);
      const a = parts[3] != null ? clamp(parseFloat(parts[3]), 0, 1) : 1;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
    }
  }
  match = text.match(/^hsla?\((.+)\)$/i);
  if (match) {
    const parts = match[1].split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const h = parseFloat(parts[0]);
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;
      const a = parts[3] != null ? clamp(parseFloat(parts[3]), 0, 1) : 1;
      const rgb = hslToRgb(h, s, l);
      return { ...rgb, a };
    }
  }
  return null;
}

function rgbToHex({ r, g, b }) {
  const to = (v) => v.toString(16).padStart(2, "0");
  return `#${to(clamp(Math.round(r), 0, 255))}${to(clamp(Math.round(g), 0, 255))}${to(
    clamp(Math.round(b), 0, 255)
  )}`;
}

const swatchMap = new Map();
const APPEARANCE_KEYS = [
  "--app-bg",
  "--panel-bg",
  "--panel-bg-alt",
  "--text",
  "--text-muted",
  "--border",
  "--accent",
  "--accent-muted",
  "--toast-bg",
  "--toast-error-bg",
  "--toast-text",
];
const APPEARANCE_LABELS = {
  "--app-bg": "App background",
  "--panel-bg": "Panel background",
  "--panel-bg-alt": "Panel alt",
  "--text": "Text",
  "--text-muted": "Text muted",
  "--border": "Border",
  "--accent": "Accent",
  "--accent-muted": "Accent muted",
  "--toast-bg": "Toast background",
  "--toast-error-bg": "Toast error",
  "--toast-text": "Toast text",
};

function initSwatches(keys) {
  swatchMap.clear();
  if (!appearanceSwatchGrid) return;
  appearanceSwatchGrid.innerHTML = "";
  keys.forEach((key) => {
    const row = document.createElement("div");
    row.className = "appearanceSwatchRow";
    row.setAttribute("data-key", key);

    const label = document.createElement("div");
    label.className = "small";
    label.textContent = APPEARANCE_LABELS[key] || key;

    const controls = document.createElement("div");
    controls.className = "appearanceSwatchControls";

    const input = document.createElement("input");
    input.className = "appearanceSwatchInput";
    input.type = "color";

    const alpha = document.createElement("input");
    alpha.className = "appearanceSwatchAlpha";
    alpha.type = "range";
    alpha.min = "0";
    alpha.max = "100";
    alpha.step = "1";

    controls.appendChild(input);
    controls.appendChild(alpha);

    row.appendChild(label);
    row.appendChild(controls);
    appearanceSwatchGrid.appendChild(row);
    swatchMap.set(key, { row, input, alpha });
  });
}

function setSwatchValue(key, hexValue) {
  const entry = swatchMap.get(key);
  if (!entry) return;
  const parsed = parseColor(hexValue);
  if (parsed) {
    if (entry.input) entry.input.value = rgbToHex(parsed);
    if (entry.alpha) entry.alpha.value = String(Math.round(clamp(parsed.a, 0, 1) * 100));
    return;
  }
  const hex = toHex(hexValue, "#000000");
  if (entry.input) entry.input.value = hex;
  if (entry.alpha) entry.alpha.value = "100";
}

function buildDraftVarsFromSwatches(existing) {
  const vars = { ...(existing || {}) };
  for (const [key, entry] of swatchMap.entries()) {
    const hex = entry.input?.value || "#000000";
    const base = toHex(hex, "#000000");
    const alphaValue = entry.alpha ? clamp(parseFloat(entry.alpha.value) / 100, 0, 1) : 1;
    if (alphaValue < 1) {
      const parsed = parseColor(base) || { r: 0, g: 0, b: 0, a: alphaValue };
      vars[key] = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${formatAlpha(alphaValue)})`;
    } else {
      vars[key] = base;
    }
  }
  return vars;
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
  autoIdEnabled = true;
  setInputValue(appearanceId, draft.id);
  setInputValue(appearanceLabel, draft.label);
  const vars = draft.vars || {};
  const keys = Array.from(new Set([...APPEARANCE_KEYS, ...Object.keys(vars || {})]));
  initSwatches(keys);
  keys.forEach((key) => {
    const value = vars[key];
    if (typeof value === "string" && value.trim()) {
      setSwatchValue(key, value);
    } else if (key === "--toast-text") {
      setSwatchValue(key, "#ffffff");
    } else if (key === "--app-bg") {
      setSwatchValue(key, "#e7edf4");
    }
  });
}

function readInputsToDraft(draft) {
  if (!draft) return;
  const id = appearanceId?.value.trim();
  const label = appearanceLabel?.value.trim();
  if (id) draft.id = id;
  draft.label = label || draft.id;
  draft.vars = buildDraftVarsFromSwatches(draft.vars || {});
}

function applyDraftPreview(draft) {
  if (!draft) return;
  applyAppearanceVars({ vars: draft.vars });
  window.operator?.previewAppearance?.(draft.vars).catch(() => {});
  if (appearanceEditorPreview && draft.vars) {
    for (const [key, value] of Object.entries(draft.vars)) {
      appearanceEditorPreview.style.setProperty(key, String(value));
    }
  }
}

function renderAppearanceList() {
  if (!appearanceList) return;
  appearanceList.innerHTML = "";
  appearanceDrafts.forEach((item) => {
    const row = document.createElement("div");
    row.className = "appearanceItem";
    if (item.id === selectedAppearanceId) row.classList.add("selected");

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

    const actions = document.createElement("div");
    actions.className = "appearanceActions";
    if (item.id === selectedAppearanceId) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        openAppearanceEditor(item.id);
      };
      actions.appendChild(editBtn);
    }

      row.onclick = async () => {
        const id = item.id;
        if (!id) return;
        selectedAppearanceId = id;
        renderAppearanceList();
        try {
          await window.operator?.setAppearance?.(id);
        } catch {}
      };

    row.appendChild(left);
    row.appendChild(actions);
    appearanceList.appendChild(row);
  });
}

function openAppearanceEditor(id) {
  const draft = findDraft(id);
  if (!draft) return;
  editingAppearanceId = id;
  autoIdEnabled = true;
  appearanceEditSnapshot = { id: draft.id, label: draft.label, vars: { ...(draft.vars || {}) } };
  applyDraftToInputs(draft);
  applyDraftPreview(draft);
  attachAppearanceInputHandlers();
  if (appearanceEditorOverlay) {
    appearanceEditorOverlay.classList.add("open");
    appearanceEditorOverlay.setAttribute("aria-hidden", "false");
  }
}

function closeAppearanceEditor() {
  appearanceEditSnapshot = null;
  editingAppearanceId = null;
  if (appearanceEditorOverlay) {
    appearanceEditorOverlay.classList.remove("open");
    appearanceEditorOverlay.setAttribute("aria-hidden", "true");
  }
}


function attachAppearanceInputHandlers() {
  const basicInputs = [appearanceId, appearanceLabel].filter(Boolean);
  basicInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const targetId = editingAppearanceId || selectedAppearanceId;
      const draft = findDraft(targetId);
      if (!draft) return;
      if (input === appearanceId) autoIdEnabled = false;
      if (input === appearanceLabel && autoIdEnabled) {
        const slug = String(appearanceLabel.value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (slug) appearanceId.value = slug;
      }
      readInputsToDraft(draft);
      applyDraftPreview(draft);
    });
  });
  for (const [key, entry] of swatchMap.entries()) {
    if (entry.input) {
      entry.input.addEventListener("input", () => {
        const draft = findDraft(editingAppearanceId || selectedAppearanceId);
        if (!draft) return;
        draft.vars = draft.vars || {};
        const base = toHex(entry.input.value, "#000000");
        const alphaValue = entry.alpha ? clamp(parseFloat(entry.alpha.value) / 100, 0, 1) : 1;
        if (alphaValue < 1) {
          const parsed = parseColor(base) || { r: 0, g: 0, b: 0, a: alphaValue };
          draft.vars[key] = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${formatAlpha(alphaValue)})`;
        } else {
          draft.vars[key] = base;
        }
        setSwatchValue(key, draft.vars[key]);
        applyDraftPreview(draft);
      });
    }
    if (entry.alpha) {
      entry.alpha.addEventListener("input", () => {
        const draft = findDraft(editingAppearanceId || selectedAppearanceId);
        if (!draft) return;
        draft.vars = draft.vars || {};
        const base = toHex(entry.input?.value || "#000000", "#000000");
        const alphaValue = clamp(parseFloat(entry.alpha.value) / 100, 0, 1);
        if (alphaValue < 1) {
          const parsed = parseColor(base) || { r: 0, g: 0, b: 0, a: alphaValue };
          draft.vars[key] = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${formatAlpha(alphaValue)})`;
        } else {
          draft.vars[key] = base;
        }
        setSwatchValue(key, draft.vars[key]);
        applyDraftPreview(draft);
      });
    }
  }
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
    selectedAppearanceId = activeId;
    renderAppearanceList();
  } catch {}
  activeOverlay = "appearance";
  setOverlayState(appearanceOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  const draft = findDraft(selectedAppearanceId);
  if (draft) applyDraftPreview(draft);
}

async function closeAppearance(revert) {
  setOverlayState(appearanceOverlay, false);
  if (activeOverlay === "appearance") activeOverlay = null;
  if (revert) {
    window.operator?.clearAppearancePreview?.().catch(() => {});
  }
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
        await window.operator?.clearAppearancePreview?.();
        await closeAppearance(false);
        showToast("Appearance updated.");
      } else {
        showToast(res?.error ? `Save failed: ${res.error}` : "Save failed.", "error");
      }
    } catch {}
  };
}

if (appearanceEditorClose) appearanceEditorClose.onclick = () => closeAppearanceEditor();
if (appearanceEditorCancel) appearanceEditorCancel.onclick = () => {
  if (appearanceEditSnapshot && editingAppearanceId) {
    const draft = findDraft(editingAppearanceId);
    if (draft) {
      draft.id = appearanceEditSnapshot.id;
      draft.label = appearanceEditSnapshot.label;
      draft.vars = { ...(appearanceEditSnapshot.vars || {}) };
      renderAppearanceList();
      if (draft.id === selectedAppearanceId) {
        applyDraftPreview(draft);
      }
    }
  }
  window.operator?.clearAppearancePreview?.().catch(() => {});
  closeAppearanceEditor();
};
if (appearanceEditorSave) {
  appearanceEditorSave.onclick = () => {
    if (!editingAppearanceId) return;
    const draft = findDraft(editingAppearanceId);
    if (!draft) return;
    readInputsToDraft(draft);
    const ids = appearanceDrafts.map((a) => a.id).filter(Boolean);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      showToast("Appearance ids must be unique.", "error");
      return;
    }
    if (editingAppearanceId !== draft.id) {
      if (selectedAppearanceId === editingAppearanceId) selectedAppearanceId = draft.id;
      editingAppearanceId = draft.id;
    }
    renderAppearanceList();
    if (draft.id === selectedAppearanceId) applyDraftPreview(draft);
    window.operator?.clearAppearancePreview?.().catch(() => {});
    closeAppearanceEditor();
  };
}

if (appearanceEditorCopy) {
  appearanceEditorCopy.onclick = async () => {
    if (!editingAppearanceId) return;
    const draft = findDraft(editingAppearanceId);
    if (!draft) return;
    readInputsToDraft(draft);
    const payload = { id: draft.id, label: draft.label, vars: draft.vars };
    try {
      await window.operator?.copyToClipboard?.(JSON.stringify(payload, null, 2));
      showToast("Appearance definition copied.");
    } catch {}
  };
}

if (appearanceEditorPaste) {
  appearanceEditorPaste.onclick = async () => {
    if (!editingAppearanceId) return;
    const draft = findDraft(editingAppearanceId);
    if (!draft) return;
    try {
      const clip = await window.operator?.readClipboard?.();
      const text = clip?.text || "";
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        showToast("Clipboard does not contain an appearance definition.", "error");
        return;
      }
      if (parsed.label) draft.label = String(parsed.label);
      if (parsed.vars && typeof parsed.vars === "object") {
        draft.vars = { ...(draft.vars || {}), ...parsed.vars };
      }
      applyDraftToInputs(draft);
      applyDraftPreview(draft);
      showToast("Appearance definition pasted.");
    } catch (e) {
      showToast("Paste failed: invalid JSON.", "error");
    }
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
    renderAppearanceList();
    openAppearanceEditor(id);
  };
}

if (appearanceRemove) {
  appearanceRemove.onclick = () => {
    if (!selectedAppearanceId) return;
    if (appearanceDrafts.length <= 1) {
      showToast("At least one appearance is required.", "error");
      return;
    }
    appearanceDrafts = appearanceDrafts.filter((a) => a.id !== selectedAppearanceId);
    selectedAppearanceId = appearanceDrafts[0]?.id || null;
    renderAppearanceList();
    if (selectedAppearanceId) {
      window.operator?.setAppearance?.(selectedAppearanceId).catch(() => {});
    }
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

if (appearanceEditorOverlay) {
  appearanceEditorOverlay.addEventListener("click", (ev) => {
    if (ev.target === appearanceEditorOverlay) closeAppearanceEditor();
  });
}


window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (appearanceEditorOverlay && appearanceEditorOverlay.classList.contains("open")) {
    closeAppearanceEditor();
    return;
  }
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
