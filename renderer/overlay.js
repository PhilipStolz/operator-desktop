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
const appearanceSplitHandle = document.getElementById("appearanceSplitHandle");
const alphaPopup = document.getElementById("alphaPopup");
const alphaSlider = document.getElementById("alphaSlider");
const alphaValue = document.getElementById("alphaValue");
const menuLayer = document.getElementById("menuLayer");
const menuWorkspace = document.getElementById("menuWorkspace");
const menuSettings = document.getElementById("menuSettings");
const menuHelp = document.getElementById("menuHelp");
const menuSelectWorkspace = document.getElementById("menuSelectWorkspace");
const menuCloseWorkspace = document.getElementById("menuCloseWorkspace");
const menuRecentList = document.getElementById("menuRecentList");
const menuLlmProfiles = document.getElementById("menuLlmProfiles");
const menuAppearance = document.getElementById("menuAppearance");
const menuGettingStarted = document.getElementById("menuGettingStarted");
const menuUserGuide = document.getElementById("menuUserGuide");
const guidedOverlay = document.getElementById("guidedOverlay");
const guidedSpotlight = document.getElementById("guidedSpotlight");
const guidedTooltip = document.getElementById("guidedTooltip");
const guidedStep = document.getElementById("guidedStep");
const guidedTitle = document.getElementById("guidedTitle");
const guidedBody = document.getElementById("guidedBody");
const guidedPrev = document.getElementById("guidedPrev");
const guidedNext = document.getElementById("guidedNext");
const guidedClose = document.getElementById("guidedClose");
const guideOverlay = document.getElementById("guideOverlay");
const guideSearchInput = document.getElementById("guideSearchInput");
const guideNav = document.getElementById("guideNav");
const guideContent = document.getElementById("guideContent");
const guideCloseBtn = document.getElementById("guideCloseBtn");

let activeOverlay = null;
let llmOpenSeq = 0;
let selectedAppearanceId = null;
let appearanceOpenSeq = 0;
let appearanceOriginalId = null;
let appearanceDrafts = [];
let editingAppearanceId = null;
let autoIdEnabled = true;
let appearanceEditSnapshot = null;
let alphaPopupEntry = null;
let appearanceHandlersBound = false;
let openMenuId = null;
let splitDragActive = false;
let guidedIndex = 0;
let guidedSeq = 0;
let guideInitialized = false;
let guideActiveId = null;
const guidedSteps = [
  { title: "Choose workspace", body: "Pick a workspace root to enable file commands.", selector: "#btnWorkspace", view: "topbar" },
  { title: "Select LLM provider", body: "Choose the LLM provider in the top bar.", selector: "#llmProfile", view: "topbar" },
  { title: "Copy bootstrap prompt", body: "Click to copy the prompt, then paste it into the LLM chat (Ctrl+V on Windows/Linux, Cmd+V on macOS).", selector: "#btnCopyBootstrap", view: "sidebar" },
  { title: "Run Extract & Scan", body: "Extract commands from the chat.", selector: "#btnExtract", view: "sidebar" },
  { title: "Review the Command Inbox", body: "Inspect commands and execute them.", selector: "#inboxSection", view: "sidebar" },
  { title: "Copy result back to the LLM", body: "Copy the execution result, then paste it into the LLM chat (Ctrl+V on Windows/Linux, Cmd+V on macOS).", selector: "#btnCopyResult", view: "sidebar" },
];

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
  "--error",
  "--warning",
  "--overlay-bg",
  "--modal-bg",
  "--modal-header-bg",
  "--modal-footer-bg",
  "--modal-shadow",
  "--focus-ring",
  "--button-primary-text",
  "--control-bg",
  "--control-text",
  "--control-border",
  "--error-bg",
  "--error-border",
  "--success",
  "--success-border",
  "--success-bg",
  "--warning-bg",
  "--warning-accent",
  "--danger",
  "--danger-active",
  "--topbar-divider",
  "--topbar-shadow",
  "--toast-bg",
  "--toast-error-bg",
  "--toast-text",
  "--toast-shadow",
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
  "--error": "Error",
  "--warning": "Warning",
  "--overlay-bg": "Overlay background",
  "--modal-bg": "Modal background",
  "--modal-header-bg": "Modal header",
  "--modal-footer-bg": "Modal footer",
  "--modal-shadow": "Modal shadow",
  "--focus-ring": "Focus ring",
  "--button-primary-text": "Primary button text",
  "--control-bg": "Control background",
  "--control-text": "Control text",
  "--control-border": "Control border",
  "--error-bg": "Error background",
  "--error-border": "Error border",
  "--success": "Success accent",
  "--success-border": "Success border",
  "--success-bg": "Success background",
  "--warning-bg": "Warning background",
  "--warning-accent": "Warning accent",
  "--danger": "Danger",
  "--danger-active": "Danger active",
  "--topbar-divider": "Topbar divider",
  "--topbar-shadow": "Topbar shadow",
  "--toast-bg": "Toast background",
  "--toast-error-bg": "Toast error",
  "--toast-text": "Toast text",
  "--toast-shadow": "Toast shadow",
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

    const alphaToggle = document.createElement("button");
    alphaToggle.className = "appearanceAlphaToggle";
    alphaToggle.type = "button";
    alphaToggle.title = "Alpha";
    alphaToggle.textContent = "a";

    const alpha = document.createElement("input");
    alpha.className = "appearanceSwatchAlpha";
    alpha.type = "range";
    alpha.min = "0";
    alpha.max = "100";
    alpha.step = "1";

    controls.appendChild(input);
    controls.appendChild(alphaToggle);
    controls.appendChild(alpha);

    row.appendChild(label);
    row.appendChild(controls);
    appearanceSwatchGrid.appendChild(row);
    swatchMap.set(key, { row, input, alpha, alphaToggle, hasValue: false, bound: false });
  });
}

function setSwatchValue(key, hexValue) {
  const entry = swatchMap.get(key);
  if (!entry) return;
  const parsed = parseColor(hexValue);
  if (parsed) {
    if (entry.input) entry.input.value = rgbToHex(parsed);
    if (entry.alpha) entry.alpha.value = String(Math.round(clamp(parsed.a, 0, 1) * 100));
    entry.hasValue = true;
    return;
  }
  const hex = toHex(hexValue, "#000000");
  if (entry.input) entry.input.value = hex;
  if (entry.alpha) entry.alpha.value = "100";
  entry.hasValue = true;
}

function buildDraftVarsFromSwatches(existing) {
  const vars = { ...(existing || {}) };
  for (const [key, entry] of swatchMap.entries()) {
    if (!entry.hasValue) {
      if (existing && Object.prototype.hasOwnProperty.call(existing, key)) {
        vars[key] = existing[key];
      }
      continue;
    }
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
    } else {
      const computed = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
      if (computed) setSwatchValue(key, computed);
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
        if (item && item.vars) {
          applyDraftPreview(item);
        }
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
  closeAlphaPopup();
  if (appearanceEditorOverlay) {
    appearanceEditorOverlay.classList.add("open");
    appearanceEditorOverlay.setAttribute("aria-hidden", "false");
  }
}

function closeAppearanceEditor() {
  appearanceEditSnapshot = null;
  editingAppearanceId = null;
  closeAlphaPopup();
  if (appearanceEditorOverlay) {
    appearanceEditorOverlay.classList.remove("open");
    appearanceEditorOverlay.setAttribute("aria-hidden", "true");
  }
}


function attachAppearanceInputHandlers() {
  if (!appearanceHandlersBound) {
    const basicInputs = [appearanceId, appearanceLabel].filter(Boolean);
    basicInputs.forEach((input) => {
      input.addEventListener("input", () => {
        const targetId = editingAppearanceId || selectedAppearanceId;
        const draft = findDraft(targetId) || findDraft(appearanceId?.value.trim());
        if (!draft) return;
        if (input === appearanceId) autoIdEnabled = false;
        if (input === appearanceLabel && autoIdEnabled) {
          const base = String(appearanceLabel.value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          if (base) {
            let candidate = base;
            let suffix = 1;
            while (appearanceDrafts.some((a) => a.id === candidate && a !== draft)) {
              candidate = `${base}-${suffix++}`;
            }
            appearanceId.value = candidate;
          }
        }
        const previousId = draft.id;
        readInputsToDraft(draft);
        if (draft.id && draft.id !== previousId) {
          if (selectedAppearanceId === previousId) selectedAppearanceId = draft.id;
          if (editingAppearanceId === previousId) editingAppearanceId = draft.id;
          renderAppearanceList();
        }
        applyDraftPreview(draft);
      });
    });
    appearanceHandlersBound = true;
  }
  for (const [key, entry] of swatchMap.entries()) {
    if (entry.bound) continue;
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
        entry.hasValue = true;
        setSwatchValue(key, draft.vars[key]);
        applyDraftPreview(draft);
      });
    }
    if (entry.alpha) {
      if (entry.alphaToggle) {
        entry.alphaToggle.addEventListener("click", () => {
          openAlphaPopup(entry);
        });
      }
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
        entry.hasValue = true;
        setSwatchValue(key, draft.vars[key]);
        applyDraftPreview(draft);
      });
    }
    entry.bound = true;
  }
}

function openAlphaPopup(entry) {
  if (!alphaPopup || !alphaSlider || !alphaValue) return;
  if (alphaPopupEntry === entry && alphaPopup.classList.contains("open")) {
    closeAlphaPopup();
    return;
  }
  alphaPopupEntry = entry;
  if (alphaPopupEntry?.alphaToggle) {
    alphaPopupEntry.alphaToggle.classList.add("active");
  }
  const rect = entry.alphaToggle?.getBoundingClientRect?.();
  const value = entry.alpha ? entry.alpha.value : "100";
  alphaSlider.value = value;
  alphaValue.value = formatAlpha(clamp(parseFloat(value) / 100, 0, 1));
  if (rect) {
    const left = Math.min(rect.left, window.innerWidth - 120);
    const top = Math.max(8, rect.top - 170);
    alphaPopup.style.left = `${left}px`;
    alphaPopup.style.top = `${top}px`;
  }
  alphaPopup.classList.add("open");
  alphaPopup.setAttribute("aria-hidden", "false");
}

function closeAlphaPopup() {
  if (!alphaPopup) return;
  if (alphaPopupEntry?.alphaToggle) {
    alphaPopupEntry.alphaToggle.classList.remove("active");
  }
  alphaPopupEntry = null;
  alphaPopup.classList.remove("open");
  alphaPopup.setAttribute("aria-hidden", "true");
}

function updateAlphaFromPopup(source) {
  if (!alphaPopupEntry || !alphaSlider || !alphaValue) return;
  let alphaPercent = parseFloat(alphaSlider.value);
  if (source === "value") {
    const value = clamp(parseFloat(alphaValue.value || "1"), 0, 1);
    alphaPercent = Math.round(value * 100);
    alphaSlider.value = String(alphaPercent);
  } else {
    const value = clamp(alphaPercent / 100, 0, 1);
    alphaValue.value = formatAlpha(value);
  }
  if (alphaPopupEntry.alpha) {
    alphaPopupEntry.alpha.value = String(alphaPercent);
    alphaPopupEntry.alpha.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

if (alphaSlider) alphaSlider.addEventListener("input", () => updateAlphaFromPopup("slider"));
if (alphaValue) alphaValue.addEventListener("input", () => updateAlphaFromPopup("value"));

function closeMenus() {
  [menuWorkspace, menuSettings, menuHelp].forEach((menu) => {
    if (menu) menu.classList.remove("open");
  });
  if (menuLayer) {
    menuLayer.setAttribute("aria-hidden", "true");
    menuLayer.classList.remove("active");
  }
  openMenuId = null;
}

function requestCloseMenu() {
  if (window.operator?.closeMenu) {
    window.operator.closeMenu().catch(() => {});
    return;
  }
  closeMenus();
}

function positionGuidedElements(rect) {
  if (!guidedSpotlight || !guidedTooltip) return;
  const pad = 6;
  guidedSpotlight.style.left = `${rect.left - pad}px`;
  guidedSpotlight.style.top = `${rect.top - pad}px`;
  guidedSpotlight.style.width = `${rect.width + pad * 2}px`;
  guidedSpotlight.style.height = `${rect.height + pad * 2}px`;
  const tooltipTop = Math.min(window.innerHeight - 10, rect.bottom + 12);
  const tooltipLeft = Math.min(window.innerWidth - 340, Math.max(10, rect.left));
  guidedTooltip.style.left = `${tooltipLeft}px`;
  guidedTooltip.style.top = `${tooltipTop}px`;
}

async function resolveGuidedRect(step) {
  if (!step || !step.selector) return null;
  if (window.operator?.getGuidedRect) {
    try {
      const rect = await window.operator.getGuidedRect({
        selector: step.selector,
        view: step.view || "sidebar",
      });
      // scrollIntoView is executed in the target view before returning its rect.
      if (rect && typeof rect.left === "number") {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.top + rect.height };
      }
    } catch (err) {
      console.warn("guided rect lookup failed", err);
    }
  }
  return null;
}

async function showGuidedStep(index) {
  if (!guidedOverlay || !guidedSpotlight || !guidedTooltip) return;
  const seq = ++guidedSeq;
  guidedTooltip.style.opacity = "0";
  guidedSpotlight.style.opacity = "0";
  guidedTooltip.style.visibility = "hidden";
  guidedSpotlight.style.visibility = "hidden";
  const steps = guidedSteps;
  let i = index;
  let found = null;
  const direction = index >= guidedIndex ? 1 : -1;
  while (i >= 0 && i < steps.length) {
    const step = steps[i];
    const rect = await resolveGuidedRect(step);
    if (seq !== guidedSeq) return;
    if (!rect) {
      i += direction;
      continue;
    }
    found = { step, index: i, rect };
    break;
  }
  if (!found) {
    guidedIndex = 0;
    if (guidedStep) guidedStep.textContent = `Step 1 / ${steps.length}`;
    if (guidedTitle) guidedTitle.textContent = steps[0]?.title || "Getting Started";
    if (guidedBody) guidedBody.textContent = steps[0]?.body || "";
    if (guidedSpotlight) {
      guidedSpotlight.style.left = "20px";
      guidedSpotlight.style.top = "20px";
      guidedSpotlight.style.width = "180px";
      guidedSpotlight.style.height = "40px";
    }
    if (guidedTooltip) {
      guidedTooltip.style.left = "20px";
      guidedTooltip.style.top = "70px";
    }
    guidedTooltip.style.opacity = "1";
    guidedSpotlight.style.opacity = "1";
    guidedTooltip.style.visibility = "visible";
    guidedSpotlight.style.visibility = "visible";
    if (guidedPrev) {
      guidedPrev.disabled = true;
      guidedPrev.style.display = "none";
    }
    if (guidedNext) guidedNext.textContent = steps.length <= 1 ? "Done" : "Next";
    return;
  }
  guidedIndex = found.index;
  if (guidedStep) guidedStep.textContent = `Step ${found.index + 1} / ${steps.length}`;
  if (guidedTitle) guidedTitle.textContent = found.step.title;
  if (guidedBody) guidedBody.textContent = found.step.body;
  positionGuidedElements(found.rect);
  guidedTooltip.style.opacity = "1";
  guidedSpotlight.style.opacity = "1";
  guidedTooltip.style.visibility = "visible";
  guidedSpotlight.style.visibility = "visible";
  if (guidedPrev) {
    guidedPrev.disabled = found.index === 0;
    guidedPrev.style.display = found.index === 0 ? "none" : "";
  }
  if (guidedNext) guidedNext.textContent = found.index === steps.length - 1 ? "Done" : "Next";
}

function openGuidedGettingStarted() {
  if (!guidedOverlay) return;
  guidedOverlay.classList.add("open");
  guidedOverlay.setAttribute("aria-hidden", "false");
  guidedIndex = 0;
  if (guidedTooltip) {
    guidedTooltip.style.opacity = "0";
    guidedTooltip.style.visibility = "hidden";
  }
  if (guidedSpotlight) {
    guidedSpotlight.style.opacity = "0";
    guidedSpotlight.style.visibility = "hidden";
  }
  void showGuidedStep(guidedIndex);
}

function closeGuidedGettingStarted() {
  if (!guidedOverlay) return;
  guidedOverlay.classList.remove("open");
  guidedOverlay.setAttribute("aria-hidden", "true");
  try {
    window.operator?.closeGettingStarted?.();
  } catch {}
}

function getGuideSections() {
  return [
    {
      id: "overview",
      title: "Overview",
      body: `
        <p>Operator helps you run file and UI commands safely while keeping the LLM in the loop.</p>
        <p>The usual flow is: choose a workspace, select an LLM provider, copy the bootstrap prompt, extract commands, then execute and paste results back.</p>
        <div class="guideDemo">
          <div class="guideRow">
            <span class="guidePill">Workspace</span>
            <span class="guidePill">LLM provider</span>
            <span class="guidePill">Inbox</span>
            <span class="guidePill">Results</span>
          </div>
        </div>
      `,
    },
    {
      id: "workspace-llm",
      title: "Workspace and LLM provider",
      body: `
        <p>Select a workspace to enable file commands. Then pick the LLM provider you want to use.</p>
        <div class="guideDemo">
          <div class="guideRow">
            <button class="guideBtnGhost">Choose Workspace</button>
            <span class="guidePill">Workspace: (not set)</span>
            <span class="guidePill">LLM provider: Chat</span>
          </div>
        </div>
      `,
    },
    {
      id: "bootstrap",
      title: "Bootstrap prompt",
      body: `
        <p>Use the copy button to place the bootstrap prompt on your clipboard, then paste it into the LLM chat (Ctrl+V on Windows/Linux, Cmd+V on macOS).</p>
        <div class="guideDemo">
          <div class="guideRow">
            <button class="guideBtnGhost">Copy LLM Bootstrap Prompt</button>
            <span class="guidePill">Clipboard</span>
          </div>
        </div>
      `,
    },
    {
      id: "extract",
      title: "Extract and scan",
      body: `
        <p>Click the primary Extract & Scan button to capture commands from the chat.</p>
        <p>If auto extract & scan is enabled, the app runs this step in short intervals.</p>
        <div class="guideDemo">
          <div class="guideRow">
            <button class="guideBtnPrimary">Extract & Scan</button>
            <button class="guideBtnGhost">Scan Clipboard</button>
          </div>
        </div>
      `,
    },
    {
      id: "inbox",
      title: "Command Inbox",
      body: `
        <p>Review commands, inspect details, then execute or dismiss them.</p>
        <div class="guideDemo">
          <div class="guideCard">
            <strong>cmd-1024</strong>
            <span>fs.readFile path=notes.md</span>
            <div class="guideRow">
              <span class="guidePill">NOT RUN</span>
              <button class="guideBtnGhost">Details</button>
              <button class="guideBtnPrimary">Execute</button>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: "results",
      title: "Results",
      body: `
        <p>After execution, copy the result and paste it back into the LLM chat.</p>
        <div class="guideDemo">
          <div class="guideRow">
            <button class="guideBtnGhost">Copy Result</button>
            <span class="guidePill">Ctrl/Cmd+V</span>
          </div>
        </div>
      `,
    },
    {
      id: "errors",
      title: "Execution errors",
      body: `
        <p>Error cards explain what went wrong and let you copy an error result for the LLM.</p>
        <div class="guideDemo">
          <div class="guideCard">
            <strong>Invalid OPERATOR_CMD (ERR_INVALID_BASE64)</strong>
            <span>related id: badb64-001</span>
            <div class="guideRow">
              <button class="guideBtnGhost">Copy result</button>
              <button class="guideBtnGhost">Dismiss</button>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: "appearance",
      title: "Appearance",
      body: `
        <p>Appearances let you tweak colors without touching code.</p>
        <div class="guideDemo">
          <div class="guideRow">
            <div class="guideSwatch"></div>
            <div class="guideSwatch" style="background: var(--panel-bg-alt);"></div>
            <div class="guideSwatch" style="background: var(--error);"></div>
            <div class="guideSwatch" style="background: var(--warning);"></div>
          </div>
        </div>
      `,
    },
  ];
}

function setActiveGuideNav(id) {
  guideActiveId = id;
  if (!guideNav) return;
  const buttons = Array.from(guideNav.querySelectorAll("button"));
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.dataset.target === id);
  }
}

function applyGuideSearch() {
  if (!guideSearchInput || !guideNav || !guideContent) return;
  const q = (guideSearchInput.value || "").trim().toLowerCase();
  const sections = Array.from(guideContent.querySelectorAll(".guideSection"));
  let firstVisible = null;
  for (const section of sections) {
    const hay = (section.dataset.search || "").toLowerCase();
    const visible = !q || hay.includes(q);
    section.style.display = visible ? "" : "none";
    if (visible && !firstVisible) firstVisible = section;
  }
  const navButtons = Array.from(guideNav.querySelectorAll("button"));
  for (const btn of navButtons) {
    const targetId = btn.dataset.target;
    const section = targetId ? document.getElementById(targetId) : null;
    btn.style.display = section && section.style.display === "none" ? "none" : "";
  }
  if (firstVisible && firstVisible.id) setActiveGuideNav(firstVisible.id);
}

function initGuide() {
  if (!guideContent || !guideNav || guideInitialized) return;
  guideInitialized = true;
  const closeRow = guideContent.querySelector(".guideCloseRow");
  const sections = getGuideSections();
  for (const section of sections) {
    const navBtn = document.createElement("button");
    navBtn.textContent = section.title;
    navBtn.dataset.target = `guide-${section.id}`;
    navBtn.onclick = () => {
      const target = document.getElementById(`guide-${section.id}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveGuideNav(`guide-${section.id}`);
    };
    guideNav.appendChild(navBtn);
  }
  if (closeRow) guideContent.innerHTML = "";
  if (closeRow) guideContent.appendChild(closeRow);
  for (const section of sections) {
    const sectionEl = document.createElement("section");
    sectionEl.className = "guideSection";
    sectionEl.id = `guide-${section.id}`;
    sectionEl.innerHTML = `<h3>${section.title}</h3>${section.body}`;
    const textContent = sectionEl.textContent || "";
    sectionEl.dataset.search = `${section.title} ${textContent}`.trim();
    guideContent.appendChild(sectionEl);
  }
  if (guideSearchInput) {
    guideSearchInput.addEventListener("input", applyGuideSearch);
  }
  if (sections.length) setActiveGuideNav(`guide-${sections[0].id}`);
}

function openUserGuide() {
  initGuide();
  activeOverlay = "guide";
  setOverlayState(guideOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  setOverlayState(appearanceOverlay, false);
  if (guideSearchInput) {
    guideSearchInput.value = "";
    guideSearchInput.focus();
  }
  applyGuideSearch();
}

async function closeUserGuide() {
  setOverlayState(guideOverlay, false);
  if (activeOverlay === "guide") activeOverlay = null;
  try {
    await window.operator?.closeUserGuide?.();
  } catch {}
}

function openMenu(payload) {
  if (!payload) return;
  const { menu, rect } = payload;
  closeMenus();
  let target = null;
  if (menu === "workspace") target = menuWorkspace;
  if (menu === "settings") target = menuSettings;
  if (menu === "help") target = menuHelp;
  if (!target) return;
  if (rect) {
    target.style.left = `${Math.max(8, rect.left)}px`;
    target.style.top = `${Math.max(8, rect.bottom + 4)}px`;
  }
  target.classList.add("open");
  if (menuLayer) {
    menuLayer.setAttribute("aria-hidden", "false");
    menuLayer.classList.add("active");
  }
  openMenuId = menu;
}

async function loadRecentWorkspaces() {
  if (!menuRecentList) return;
  menuRecentList.innerHTML = "";
  try {
    const res = await window.operator?.getRecentWorkspaces?.();
    const list = Array.isArray(res?.recentWorkspaces) ? res.recentWorkspaces : [];
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "menuEntry";
      empty.textContent = "No recent workspaces";
      empty.style.opacity = "0.6";
      menuRecentList.appendChild(empty);
      return;
    }
    for (const entry of list) {
      const item = document.createElement("div");
      item.className = "menuEntry";
      item.textContent = entry;
      item.onclick = async () => {
        requestCloseMenu();
        await window.operator?.setWorkspace?.(entry);
      };
      menuRecentList.appendChild(item);
    }
  } catch {}
}

function openGettingStarted() {
  activeOverlay = "getting";
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  setOverlayState(appearanceOverlay, false);
  openGuidedGettingStarted();
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
    const draft = findDraft(editingAppearanceId) || findDraft(appearanceId?.value.trim());
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
      attachAppearanceInputHandlers();
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
        "--error": "#8a0b0b",
        "--warning": "#a26100",
        "--overlay-bg": "rgba(0, 0, 0, 0.25)",
        "--modal-bg": "#f9fbfe",
        "--modal-header-bg": "#eef3f8",
        "--modal-footer-bg": "#eef3f8",
        "--modal-shadow": "rgba(0, 0, 0, 0.16)",
        "--focus-ring": "rgba(26, 95, 191, 0.38)",
        "--button-primary-text": "#ffffff",
        "--control-bg": "#f9fbfe",
        "--control-text": "#1b2430",
        "--control-border": "#c9d3df",
        "--error-bg": "#fff4f4",
        "--error-border": "#f1c0c0",
        "--success": "#2f8f59",
        "--success-border": "#1f6b3b",
        "--success-bg": "#f4fbf7",
        "--warning-bg": "#fff7e0",
        "--warning-accent": "#d08a0f",
        "--danger": "#c62828",
        "--danger-active": "#a31f1f",
        "--topbar-divider": "rgba(26, 95, 191, 0.2)",
        "--topbar-shadow": "rgba(0, 0, 0, 0.06)",
        "--toast-bg": "rgba(25, 25, 25, 0.92)",
        "--toast-error-bg": "rgba(110, 0, 0, 0.92)",
        "--toast-text": "#ffffff",
        "--toast-shadow": "rgba(0, 0, 0, 0.2)",
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

if (guideOverlay) {
  guideOverlay.addEventListener("click", (ev) => {
    if (ev.target === guideOverlay) closeUserGuide();
  });
}

if (guideCloseBtn) guideCloseBtn.onclick = () => closeUserGuide();

// Keep editor open on backdrop clicks.

if (menuLayer) {
  menuLayer.addEventListener("click", (ev) => {
    const target = ev.target;
    if (menuWorkspace && menuWorkspace.contains(target)) return;
    if (menuSettings && menuSettings.contains(target)) return;
    if (menuHelp && menuHelp.contains(target)) return;
    requestCloseMenu();
  });
}

window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (alphaPopup && alphaPopup.classList.contains("open")) {
    closeAlphaPopup();
    return;
  }
  if (openMenuId) {
    requestCloseMenu();
    return;
  }
  if (appearanceEditorOverlay && appearanceEditorOverlay.classList.contains("open")) {
    closeAppearanceEditor();
    return;
  }
  if (activeOverlay === "llm") closeLlmProfiles();
  else if (activeOverlay === "getting") closeGettingStarted();
  else if (activeOverlay === "appearance") closeAppearance(true);
  else if (activeOverlay === "guide") closeUserGuide();
});

if (window.operator?.onOpenGettingStarted) {
  window.operator.onOpenGettingStarted(() => {
    openGettingStarted();
  });
}

if (window.operator?.onOpenUserGuide) {
  window.operator.onOpenUserGuide(() => {
    openUserGuide();
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

if (window.operator?.onOpenMenu) {
  window.operator.onOpenMenu((payload) => {
    if (payload?.menu === "workspace") loadRecentWorkspaces();
    openMenu(payload);
  });
}

if (window.operator?.onCloseMenu) {
  window.operator.onCloseMenu(() => {
    closeMenus();
  });
}

if (window.operator?.getActiveAppearance) {
  window.operator.getActiveAppearance().then((res) => {
    applyAppearanceVars(res);
  }).catch(() => {});
}

window.__openGettingStarted = openGettingStarted;
window.__openUserGuide = openUserGuide;
window.__openLlmProfiles = openLlmProfiles;
window.__openAppearance = openAppearance;
window.__openGuidedGettingStarted = openGuidedGettingStarted;
window.__closeGuidedGettingStarted = closeGuidedGettingStarted;

attachAppearanceInputHandlers();
if (guidedPrev) {
  guidedPrev.onclick = () => {
    void showGuidedStep(Math.max(0, guidedIndex - 1));
  };
}
if (guidedNext) {
  guidedNext.onclick = () => {
    if (guidedIndex >= guidedSteps.length - 1) {
      closeGuidedGettingStarted();
      return;
    }
    void showGuidedStep(guidedIndex + 1);
  };
}
if (guidedClose) guidedClose.onclick = () => closeGuidedGettingStarted();

function initAppearanceSplit() {
  if (!appearanceSplitHandle || !appearanceSwatchGrid || !appearanceEditorPreview) return;
  appearanceSplitHandle.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    splitDragActive = true;
    const startY = ev.clientY;
    const swatchStart = appearanceSwatchGrid.getBoundingClientRect().height;
    const previewStart = appearanceEditorPreview.getBoundingClientRect().height;
    const modalBody = appearanceEditorOverlay?.querySelector(".modalBody");
    const maxTotal = modalBody ? modalBody.getBoundingClientRect().height - 80 : swatchStart + previewStart;

    const onMove = (moveEv) => {
      if (!splitDragActive) return;
      const delta = moveEv.clientY - startY;
      const nextSwatch = Math.max(120, Math.min(maxTotal - 120, swatchStart + delta));
      const nextPreview = Math.max(120, Math.min(maxTotal - 120, previewStart - delta));
      appearanceSwatchGrid.style.maxHeight = `${nextSwatch}px`;
      appearanceEditorPreview.style.maxHeight = `${nextPreview}px`;
    };

    const onUp = () => {
      splitDragActive = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

initAppearanceSplit();

document.addEventListener("click", (ev) => {
  if (!alphaPopupEntry) return;
  const target = ev.target;
  if (alphaPopup && alphaPopup.contains(target)) return;
  if (alphaPopupEntry.alphaToggle && alphaPopupEntry.alphaToggle.contains(target)) return;
  closeAlphaPopup();
});

if (menuSelectWorkspace) {
  menuSelectWorkspace.onclick = async () => {
    requestCloseMenu();
    await window.operator?.chooseWorkspace?.();
  };
}

if (menuCloseWorkspace) {
  menuCloseWorkspace.onclick = async () => {
    requestCloseMenu();
    await window.operator?.closeWorkspace?.();
  };
}

if (menuLlmProfiles) {
  menuLlmProfiles.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openLlmProfiles?.();
  };
}

if (menuAppearance) {
  menuAppearance.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openAppearance?.();
  };
}

if (menuGettingStarted) {
  menuGettingStarted.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openGettingStarted?.();
  };
}

if (menuUserGuide) {
  menuUserGuide.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openUserGuide?.();
  };
}
