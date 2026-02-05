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
const menuAbout = document.getElementById("menuAbout");
const menuCheckUpdates = document.getElementById("menuCheckUpdates");
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
const aboutOverlay = document.getElementById("aboutOverlay");
const aboutClose = document.getElementById("aboutClose");
const aboutCloseFooter = document.getElementById("aboutCloseFooter");
const aboutVersion = document.getElementById("aboutVersion");
const aboutReleaseStatus = document.getElementById("aboutReleaseStatus");
const aboutRepo = document.getElementById("aboutRepo");
const updatesOverlay = document.getElementById("updatesOverlay");
const updatesClose = document.getElementById("updatesClose");
const updatesCloseFooter = document.getElementById("updatesCloseFooter");
const updatesCheck = document.getElementById("updatesCheck");
const updatesOpen = document.getElementById("updatesOpen");
const updatesStatus = document.getElementById("updatesStatus");

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
let guideNavState = [];
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

function normalizeVersion(raw) {
  return String(raw || "").trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split(".").map((n) => parseInt(n, 10));
  const pb = normalizeVersion(b).split(".").map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = Number.isFinite(pa[i]) ? pa[i] : 0;
    const vb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

async function openAbout() {
  closeMenus();
  activeOverlay = "about";
  setOverlayState(aboutOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  setOverlayState(appearanceOverlay, false);
  setOverlayState(appearanceEditorOverlay, false);
  setOverlayState(guideOverlay, false);
  setOverlayState(updatesOverlay, false);
  if (!aboutVersion || !aboutReleaseStatus || !aboutRepo) return;
  try {
    const info = await window.operator?.getAppInfo?.();
    aboutVersion.textContent = info?.version ? String(info.version) : "-";
    aboutReleaseStatus.textContent = info?.releaseStatus ? String(info.releaseStatus) : "-";
    aboutRepo.textContent = info?.repoUrl ? String(info.repoUrl) : "-";
  } catch {
    aboutVersion.textContent = "-";
    aboutReleaseStatus.textContent = "-";
    aboutRepo.textContent = "-";
  }
}

function closeAbout() {
  setOverlayState(aboutOverlay, false);
  if (activeOverlay === "about") activeOverlay = null;
  try {
    window.operator?.closeAbout?.();
  } catch {}
}

async function openUpdates() {
  closeMenus();
  activeOverlay = "updates";
  setOverlayState(updatesOverlay, true);
  setOverlayState(gettingOverlay, false);
  setOverlayState(llmOverlay, false);
  setOverlayState(appearanceOverlay, false);
  setOverlayState(appearanceEditorOverlay, false);
  setOverlayState(guideOverlay, false);
  setOverlayState(aboutOverlay, false);
  if (updatesStatus) updatesStatus.textContent = 'Press "Check now" to look for updates.';
}

function closeUpdates() {
  setOverlayState(updatesOverlay, false);
  if (activeOverlay === "updates") activeOverlay = null;
  try {
    window.operator?.closeUpdates?.();
  } catch {}
}

async function checkForUpdates() {
  if (!updatesStatus) return;
  updatesStatus.textContent = "Checking for updates...";
  try {
    const info = await window.operator?.getAppInfo?.();
    const repoUrl = info?.repoUrl || "";
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)(?:\.git)?$/i);
    if (!match) {
      updatesStatus.textContent = "Repository not configured.";
      return;
    }
    const slug = match[1].replace(/\.git$/i, "");
    const apiUrl = `https://api.github.com/repos/${slug}/releases/latest`;
    const res = await fetch(apiUrl, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) {
      updatesStatus.textContent = "Unable to check updates right now.";
      return;
    }
    const data = await res.json();
    const latest = normalizeVersion(data?.tag_name || data?.name || "");
    const current = normalizeVersion(info?.version || "");
    if (!latest || !current) {
      updatesStatus.textContent = "Unable to determine versions.";
      return;
    }
    const cmp = compareVersions(latest, current);
    if (cmp > 0) {
      updatesStatus.textContent = `New version available: v${latest} (current v${current}).`;
    } else if (cmp < 0) {
      updatesStatus.textContent = `You're running a newer build (v${current}) than the latest release (v${latest}).`;
    } else {
      updatesStatus.textContent = `You're up to date (v${current}).`;
    }
  } catch {
    updatesStatus.textContent = "Unable to check updates right now.";
  }
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
  "--icon-fg",
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
  "--icon-fg": "Icon color",
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

const GUIDE_ICON_DETAILS = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5c7 0 10 7 10 7s-3 7-10 7-10-7-10-7 3-7 10-7Zm0 2c-4.8 0-7.5 4.2-7.9 5 .4.8 3.1 5 7.9 5s7.5-4.2 7.9-5c-.4-.8-3.1-5-7.9-5Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"/></svg>`;
const GUIDE_ICON_EXEC = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5v14l12-7-12-7Z"/></svg>`;
const GUIDE_ICON_DISMISS = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 5l12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19l-1.4-1.4L17.6 5l1.4 1.4Z"/></svg>`;
const GUIDE_ICON_FOLDER = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6Zm0 4v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6H4Z"/></svg>`;

function renderTopbarPreview() {
  return `
    <div class="guidePreviewFrame">
      <div class="topBar">
        <div class="topBarRow">
          <div class="menuBar">
            <div class="menuItem active">Workspace</div>
            <div class="menuItem">Settings</div>
            <div class="menuItem">Help</div>
          </div>
          <div class="row">
            <div class="topBarItem">Workspace: (not set)</div>
            <button class="topBarIconBtn" aria-label="Choose Workspace">${GUIDE_ICON_FOLDER}</button>
          </div>
          <div class="row">
            <span class="small">LLM</span>
            <select class="guideCompactSelect">
              <option>Chat</option>
            </select>
            <div class="guideRowSpacer"></div>
          </div>
          <div class="row">
            <button class="topBarButton guideTopbarButton">Getting Started</button>
            <div class="guideRowSpacer"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommandRowPreview(status) {
  const statusClass = status === "executed" ? "executed" : "pending";
  return `
    <div class="cmd cmdCompact ${statusClass}">
      <div class="cmdLine">
        <div class="cmdLeft">
          <div class="cmdSelectCol">
            <span class="cmdStatusIcon ${statusClass}"></span>
          </div>
          <div class="cmdLeftText">
            <div class="cmdId">cmd-1024</div>
            <div class="cmdMeta">fs.readFile path=notes.md</div>
          </div>
        </div>
        <div class="cmdRight">
          <button class="cmdBtn" title="Details">${GUIDE_ICON_DETAILS}</button>
          <button class="cmdBtn" title="Execute">${GUIDE_ICON_EXEC}</button>
          <button class="cmdBtn" title="Dismiss">${GUIDE_ICON_DISMISS}</button>
        </div>
      </div>
    </div>
  `;
}

function renderErrorCardPreview() {
  return `
    <div class="errorCard">
      <div class="errorMessage">Invalid OPERATOR_CMD (ERR_INVALID_BASE64)</div>
      <div class="errorMeta">related: badb64-001</div>
      <div class="errorActions">
        <button>Copy result</button>
        <button>Dismiss</button>
      </div>
    </div>
  `;
}

function renderResultsPreview() {
  return `
    <div class="guideResults">
      <div class="sectionTitle">Last Result</div>
      <textarea class="guideResult" readonly>OPERATOR_RESULT (ok: true)...</textarea>
      <div class="row">
        <button class="btnGhost">Copy Result</button>
        <button class="btnGhost">Copy decoded details_b64</button>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getGuideAppInfo() {
  const info = window.__guideAppInfo || {};
  return {
    version: info.version || "0.0.4",
    releaseStatus: info.releaseStatus || "Alpha",
    repoUrl: info.repoUrl || "github.com/PhilipStolz/operator-desktop",
  };
}

function renderMenuPreview(kind) {
  if (kind === "workspace") {
    return `
      <div class="menuPopup open guideMenuPreview">
        <div class="menuEntry">Select Workspace...</div>
        <div class="menuGroupLabel">Recent Workspaces</div>
        <div class="menuEntry">/projects/operator-desktop</div>
        <div class="menuEntry">/projects/alpha</div>
        <div class="menuSeparator"></div>
        <div class="menuEntry">Close Workspace</div>
      </div>
    `;
  }
  if (kind === "help") {
    return `
      <div class="menuPopup open guideMenuPreview">
        <div class="menuEntry active">Getting Started</div>
        <div class="menuEntry">User Guide</div>
        <div class="menuSeparator"></div>
        <div class="menuEntry">About...</div>
        <div class="menuEntry">Check for Updates</div>
      </div>
    `;
  }
  return `
    <div class="menuPopup open guideMenuPreview">
      <div class="menuEntry">LLM Profiles...</div>
      <div class="menuEntry">Appearance...</div>
    </div>
  `;
}

function renderLlmProfilesDialogPreview() {
  return `
    <div class="modal guideDialogPreview">
      <div class="modalHeader">
        <div>LLM Profiles</div>
        <button>Close</button>
      </div>
      <div class="modalBody">
        <div class="small" style="margin-bottom:8px;">Add or edit LLM start URLs and allowed hosts (comma separated).</div>
        <div class="llmTable llmTableHeader">
          <div>ID</div>
          <div>Label</div>
          <div>Start URL</div>
          <div>Allowed hosts</div>
          <div></div>
        </div>
        <div class="llmTable" style="margin-top:6px;">
          <input value="chat" />
          <input value="Chat" />
          <input value="https://chat.example.com/" />
          <input value="chat.example.com" />
          <button>×</button>
        </div>
        <div class="row" style="margin-top:10px;">
          <button>Add profile</button>
        </div>
      </div>
      <div class="modalFooter">
        <button>Reset to defaults</button>
        <button>Close</button>
        <button class="btnPrimary">Save</button>
      </div>
    </div>
  `;
}

function renderAppearanceDialogPreview() {
  return `
    <div class="modal guideDialogPreview">
      <div class="modalHeader">
        <div>Appearance</div>
        <button>Close</button>
      </div>
      <div class="modalBody">
        <div class="small" style="margin-bottom:8px;">Choose a visual style for the Operator UI.</div>
        <div class="appearanceList">
          <div class="appearanceItem selected">
            <div class="appearanceRow">
              <div class="appearanceMeta">
                <div class="appearanceLabel">Operator Classic</div>
                <div class="small">operator-classic</div>
              </div>
            </div>
            <div class="appearanceActions">
              <button>Edit</button>
            </div>
          </div>
          <div class="appearanceItem">
            <div class="appearanceRow">
              <div class="appearanceMeta">
                <div class="appearanceLabel">Operator Dark Ops</div>
                <div class="small">operator-dark-ops</div>
              </div>
            </div>
            <div class="appearanceActions">
              <button>Edit</button>
            </div>
          </div>
        </div>
        <div class="row" style="justify-content:space-between; margin-top:10px;">
          <button>Add appearance</button>
          <button>Remove selected</button>
        </div>
      </div>
      <div class="modalFooter">
        <button>Reset to defaults</button>
        <button>Cancel</button>
        <button class="btnPrimary">Save</button>
      </div>
    </div>
  `;
}

function renderAppearanceEditorPreview() {
  return `
    <div class="modal guideDialogPreview">
      <div class="modalHeader">
        <div>Edit appearance</div>
        <button>Close</button>
      </div>
      <div class="modalBody">
        <div class="appearanceEditor" style="max-height: 220px; overflow: auto;">
          <div class="appearanceGrid">
            <div class="small">ID</div>
            <input type="text" value="operator-classic" />
            <div class="small">Label</div>
            <input type="text" value="Operator Classic" />
            <div class="appearanceSwatchGrid" style="max-height: 120px; overflow: auto;">
              <div class="appearanceSwatchRow">
                <div style="font-size: 11px;">App background</div>
                <div class="appearanceSwatchControls">
                  <input class="appearanceSwatchInput" type="color" value="#e7edf4" />
                  <button class="appearanceAlphaToggle" aria-label="Alpha">a</button>
                </div>
              </div>
              <div class="appearanceSwatchRow">
                <div style="font-size: 11px;">Accent</div>
                <div class="appearanceSwatchControls">
                  <input class="appearanceSwatchInput" type="color" value="#1a5fbf" />
                  <button class="appearanceAlphaToggle" aria-label="Alpha">a</button>
                </div>
              </div>
              <div class="appearanceSwatchRow">
                <div style="font-size: 11px;">Icon color</div>
                <div class="appearanceSwatchControls">
                  <input class="appearanceSwatchInput" type="color" value="#153c6f" />
                  <button class="appearanceAlphaToggle" aria-label="Alpha">a</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="appearancePreviewBox" style="max-height: 160px; overflow: auto;">
          <div class="appearancePreviewSidebar">
            <div class="small">Preview</div>
            <div class="appearancePreviewCard">Secondary</div>
            <div class="appearancePreviewCard" style="background: var(--panel-bg-alt);">Panel alt</div>
          </div>
          <div class="appearancePreviewMain">
            <div class="appearancePreviewCard" style="background: var(--error-bg); border-color: var(--error-border); color: var(--error);">Error panel</div>
            <div class="appearancePreviewCard" style="background: var(--warning-bg);">Warning bg</div>
          </div>
        </div>
      </div>
      <div class="modalFooter">
        <button>Copy definition</button>
        <button>Paste definition</button>
        <button>Cancel</button>
        <button class="btnPrimary">Save</button>
      </div>
    </div>
  `;
}

function renderCommandDetailsDialogPreview() {
  return `
    <div class="modal guideDialogPreview">
      <div class="modalHeader">
        <div class="sectionTitle">Command</div>
        <button>Close</button>
      </div>
      <div class="modalBody">
        <div class="modalMeta">status: NOT RUN</div>
        <div class="modalSection">
          <div class="modalSectionTitle">Command</div>
          <div>fs.readFile path=notes.md</div>
        </div>
        <div class="modalSection">
          <div class="modalSectionTitle">Decoded base64</div>
          <div>{"{"} "sample": "data" {"}"}</div>
        </div>
      </div>
      <div class="modalFooter">
        <button>Execute</button>
        <button>Dismiss</button>
        <button>Show decoded</button>
      </div>
    </div>
  `;
}

function getGuideSections() {
  return [
    {
      id: "overview",
      title: "Overview",
      body: `
        <p>Operator helps you run file and UI commands safely while keeping the LLM in the loop.</p>
        <p>This mini map shows the main areas: Top Bar, Sidebar, and the chat view.</p>
        <div class="guideDemo">
          <div class="guidePreviewLayout">
            <div class="guidePreviewScale">
              <div class="guidePreviewSidebarFrame">
                <div class="guidePreviewLabel">Sidebar</div>
                <div class="guidePreviewSidebar">
                  <div class="guidePreviewBlock">Operator Control</div>
                  <div class="guidePreviewBlock">Command Inbox</div>
                  <div class="guidePreviewBlock">Execution Errors</div>
                  <div class="guidePreviewBlock">Results</div>
                </div>
              </div>
            </div>
            <div class="guidePreviewScale">
              <div class="guidePreviewTopbarFrame">
                <div class="guidePreviewLabel">Top Bar</div>
                <div class="guidePreviewMain">
                  ${renderTopbarPreview()}
                  <div class="guidePreviewChat">LLM chat / web view</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p>Typical flow: set workspace -> select LLM provider -> copy bootstrap prompt -> Extract & Scan -> execute commands -> copy results back.</p>
      `,
      children: [
        {
          id: "topbar",
          title: "Top Bar",
          body: `
            <p>The top bar is the control strip above the chat area. It is always visible and is where you connect Operator to your workspace and LLM provider.</p>
            <p>Use the menu items on the left to access Workspace, Settings, and Help. The controls on the right show your current workspace and LLM provider and let you change them quickly.</p>
            ${renderTopbarPreview()}
          `,
          children: [
            {
              id: "topbar-workspace-menu",
              title: "Workspace menu",
              body: `
                <p>The Workspace menu is the primary place to set or change the workspace root.</p>
                <p>It also lists recent workspaces and lets you close the current workspace.</p>
                <div class="guideDemo">${renderMenuPreview("workspace")}</div>
              `,
            },
            {
              id: "topbar-settings-menu",
              title: "Settings menu",
              body: `
                <p>Settings contains configuration dialogs for LLM Profiles and Appearance.</p>
                <div class="guideDemo">${renderMenuPreview("settings")}</div>
              `,
              children: [
            {
              id: "settings-llm-profiles",
              title: "LLM Profiles",
              body: `
                    <p>Manage the list of LLM providers that can be chosen from the top bar.</p>
                    <div class="guideDemo">${renderLlmProfilesDialogPreview()}</div>
                  `,
              children: [
                {
                  id: "settings-llm-id",
                  title: "ID",
                  body: `<p>Unique identifier used internally and stored with commands.</p>`,
                },
                {
                  id: "settings-llm-label",
                  title: "Label",
                  body: `<p>Human-readable name shown in the top bar dropdown.</p>`,
                },
                {
                  id: "settings-llm-start-url",
                  title: "Start URL",
                  body: `<p>The URL that loads in the chat view when this provider is selected.</p>`,
                },
                {
                  id: "settings-llm-allowed-hosts",
                  title: "Allowed hosts",
                  body: `<p>Comma-separated list of domains permitted for this provider.</p>`,
                },
                {
                  id: "settings-llm-delete",
                  title: "Delete profile",
                  body: `<p>Use the delete (x) button to remove a profile.</p>`,
                },
                {
                  id: "settings-llm-add",
                  title: "Add profile",
                  body: `<p>Add a new provider entry to the list.</p>`,
                },
                {
                  id: "settings-llm-reset",
                  title: "Reset to defaults",
                  body: `<p>Restore the built-in list of providers.</p>`,
                },
              ],
            },
            {
              id: "settings-appearance",
              title: "Appearance",
              body: `
                <p>Choose and edit appearance themes for the UI.</p>
                <div class="guideDemo">${renderAppearanceDialogPreview()}</div>
              `,
              children: [
                {
                  id: "appearance-select",
                  title: "Select appearance",
                  body: `<p>Choose an appearance from the list. The UI updates immediately for preview, but the selection only becomes permanent after Save.</p>`,
                },
                {
                  id: "appearance-add",
                  title: "Add appearance",
                  body: `<p>Add a new appearance entry to the list.</p>`,
                },
                {
                  id: "appearance-remove",
                  title: "Remove selected",
                  body: `<p>Remove the currently selected appearance.</p>`,
                },
                {
                  id: "appearance-reset",
                  title: "Reset to default",
                  body: `<p>Restore the built-in appearance defaults.</p>`,
                },
                {
                  id: "appearance-edit",
                  title: "Edit",
                  body: `
                    <p>Open the Edit Appearance dialog for the selected appearance.</p>
                    <div class="guideDemo">${renderAppearanceEditorPreview()}</div>
                  `,
                  children: [
                    {
                      id: "appearance-edit-id",
                      title: "ID",
                      body: `<p>Unique identifier for the appearance.</p>`,
                    },
                    {
                      id: "appearance-edit-label",
                      title: "Label",
                      body: `<p>Display name shown in the appearance list.</p>`,
                    },
                    {
                      id: "appearance-edit-colors",
                      title: "Colors",
                      body: `
                        <p>Color swatches define the UI theme variables.</p>
                        <div class="guideDemo">
                          <div class="appearanceSwatchRow" style="max-width: 260px;">
                            <div style="font-size: 11px;">Accent</div>
                            <div class="appearanceSwatchControls">
                              <input class="appearanceSwatchInput" type="color" value="#1a5fbf" />
                              <button class="appearanceAlphaToggle" aria-label="Alpha">a</button>
                            </div>
                          </div>
                        </div>
                      `,
                    },
                    {
                      id: "appearance-edit-alpha",
                      title: "Alpha",
                      body: `
                        <p>Adjust transparency for colors that support alpha.</p>
                        <div class="guideDemo">
                          <button class="appearanceAlphaToggle" aria-label="Alpha">a</button>
                        </div>
                      `,
                    },
                    {
                      id: "appearance-edit-copy",
                      title: "Copy definition",
                      body: `<p>Copy the current appearance definition to the clipboard.</p>`,
                    },
                    {
                      id: "appearance-edit-paste",
                      title: "Paste definition",
                      body: `<p>Paste a previously copied appearance definition.</p>`,
                    },
                  ],
                },
              ],
            },
          ],
        },
            {
              id: "topbar-help-menu",
              title: "Help menu",
              body: `
                <p>Help provides Getting Started and the User Guide for quick reference.</p>
                <p>Use About to view version and release status. Use Check for Updates to see if a newer release is available.</p>
                <div class="guideDemo">${renderMenuPreview("help")}</div>
              `,
              children: [
                {
                  id: "help-getting-started",
                  title: "Getting Started",
                  body: `<p>Opens the guided walkthrough of the core workflow.</p>`,
                },
                {
                  id: "help-user-guide",
                  title: "User Guide",
                  body: `<p>Opens this searchable guide with UI explanations and examples.</p>`,
                },
                {
                  id: "help-about",
                  title: "About",
                  body: `
                    <p>Shows the current version, release status, and repository.</p>
                    <div class="guideDemo">
                      ${(() => {
                        const info = getGuideAppInfo();
                        const repo = escapeHtml(String(info.repoUrl || "").replace(/^https?:\/\//i, ""));
                        const version = escapeHtml(info.version);
                        const status = escapeHtml(info.releaseStatus);
                        return `
                      <div class="modal guideDialogPreview">
                        <div class="modalHeader">
                          <div>About Operator</div>
                          <button>Close</button>
                        </div>
                        <div class="modalBody">
                          <div class="row">
                            <div class="small">Version</div>
                            <div>${version}</div>
                          </div>
                          <div class="row">
                            <div class="small">Release status</div>
                            <div>${status}</div>
                          </div>
                          <div class="row">
                            <div class="small">Repository</div>
                            <div>${repo}</div>
                          </div>
                        </div>
                        <div class="modalFooter">
                          <button>Close</button>
                        </div>
                      </div>
                      `;
                      })()}
                    </div>
                  `,
                },
                {
                  id: "help-check-updates",
                  title: "Check for Updates",
                  body: `
                    <p>Checks GitHub Releases to see if a newer version is available.</p>
                    <div class="guideDemo">
                      ${(() => {
                        const info = getGuideAppInfo();
                        const version = escapeHtml(info.version);
                        return `
                      <div class="modal guideDialogPreview">
                        <div class="modalHeader">
                          <div>Check for Updates</div>
                          <button>Close</button>
                        </div>
                        <div class="modalBody">
                          <div class="small">You're up to date (v${version}).</div>
                          <div class="row" style="margin-top:8px;">
                            <button>Check now</button>
                            <button class="btnGhost">Open releases page</button>
                          </div>
                        </div>
                        <div class="modalFooter">
                          <button>Close</button>
                        </div>
                      </div>
                      `;
                      })()}
                    </div>
                  `,
                },
              ],
            },
            {
              id: "topbar-workspace",
              title: "Workspace status",
              body: `
                <p><strong>Why set a workspace?</strong> File commands (read/write/search) are only allowed inside the workspace root.</p>
                <p>The status text shows which workspace is active, so you can confirm commands will target the right files.</p>
              `,
            },
            {
              id: "topbar-folder",
              title: "Choose workspace (folder icon)",
              body: `
                <p>Click the folder icon to pick a workspace directory. This updates the workspace status text immediately.</p>
                <div class="guideDemo">
                  <button class="topBarIconBtn" aria-label="Choose Workspace">${GUIDE_ICON_FOLDER}</button>
                </div>
              `,
            },
            {
              id: "topbar-llm",
              title: "LLM provider dropdown",
              body: `
                <p>Select which LLM provider to use for the web chat view. This determines the URL loaded in the chat area.</p>
                <div class="guideDemo">
                  <div class="row">
                    <span class="small">LLM</span>
                    <select class="guideCompactSelect">
                      <option>Chat</option>
                    </select>
                    <div class="guideRowSpacer"></div>
                  </div>
                </div>
                <p>Manage providers via Settings -> LLM Profiles...</p>
              `,
            },
            {
              id: "topbar-getting-started",
              title: "Getting Started button",
              body: `
                <p>Opens the guided tour that walks you through the core workflow step by step.</p>
                <div class="guideDemo">
                  <div class="row">
                    <button class="topBarButton guideTopbarButton">Getting Started</button>
                    <div class="guideRowSpacer"></div>
                  </div>
                </div>
              `,
            },
          ],
        },
        {
          id: "sidebar",
          title: "Sidebar",
          body: `
            <p>The sidebar contains operational controls, inbox, errors, results, tools, and controls.</p>
          `,
          children: [
            {
              id: "sidebar-operator-control",
              title: "Operator Control",
              body: `
                <p>Run scans and copy the bootstrap prompt.</p>
                <div class="guideDemo guideSidebarDemo">
                  <button class="btnPrimary btnWide">Extract & Scan</button>
                  <div class="row">
                    <button class="btnSecondary">Scan Clipboard</button>
                    <button class="btnGhost">Copy LLM Bootstrap Prompt</button>
                    <button class="btnGhost">Clear</button>
                  </div>
                </div>
                <ul class="guideList">
                  <li><strong>Extract & Scan</strong> captures commands from the chat.</li>
                  <li><strong>Scan Clipboard</strong> scans the clipboard for commands.</li>
                  <li><strong>Copy LLM Bootstrap Prompt</strong> copies the initial prompt to your clipboard so you can paste it into the LLM chat (Ctrl+V on Windows/Linux, Cmd+V on macOS).</li>
                  <li><strong>Clear</strong> clears the inbox.</li>
                </ul>
              `,
            },
            {
              id: "sidebar-inbox",
              title: "Command Inbox",
              body: `
                <p>Review commands, open details, execute, or dismiss.</p>
                <div class="guideDemo guideSidebarDemo">
                  ${renderCommandRowPreview("pending")}
                  <div class="row" style="margin-top:8px;">
                    <label class="chk"><input type="checkbox" checked> Copy execution results to clipboard</label>
                  </div>
                  <div class="row" style="margin-top:6px;">
                    <button class="resetBtn" title="Reset executed states" aria-label="Reset executed states"></button>
                    <span class="small">Reset executed states</span>
                  </div>
                </div>
                <ul class="guideList">
                  <li>Status dot shows Executed vs Not run.</li>
                  <li><strong>Details</strong> (eye icon) opens the full command dialog.</li>
                  <li><strong>Execute</strong> (play icon) runs the command; the result appears under Results.</li>
                  <li><strong>Dismiss</strong> (X icon) removes the command from the inbox.</li>
                  <li><strong>Copy execution results to clipboard</strong> automatically copies each result.</li>
                  <li><strong>Reset executed states</strong> clears the executed markers.</li>
                </ul>
              `,
            },
            {
              id: "sidebar-errors",
              title: "Execution Errors",
              body: `
                <p>Errors appear as cards with copy + dismiss actions.</p>
                <div class="guideDemo guideSidebarDemo">
                  ${renderErrorCardPreview()}
                </div>
                <ul class="guideList">
                  <li>Error message</li>
                  <li>Related command ID (if available)</li>
                  <li>Copy result / Dismiss actions</li>
                </ul>
              `,
            },
            {
              id: "sidebar-results",
              title: "Results",
              body: `
                <p>After execution, copy the result and paste it back into the LLM.</p>
                <div class="guideDemo guideSidebarDemo">
                  ${renderResultsPreview()}
                </div>
                <ul class="guideList">
                  <li><strong>Copy Result</strong> copies the latest result. This mirrors the "Copy execution results to clipboard" option in the inbox.</li>
                  <li><strong>Copy decoded details_b64</strong> copies the decoded details payload.</li>
                </ul>
              `,
            },
            {
              id: "sidebar-tools",
              title: "Tools",
              body: `
                <p>Tools groups small utility helpers that support your workflow without affecting commands directly.</p>
              `,
              children: [
                {
                  id: "tools-base64",
                  title: "Base64 Helper",
                  body: `
                    <p>Use the Base64 helper to encode text or JSON into base64 when commands require content_b64 or similar fields.</p>
                    <div class="guideDemo guideSidebarDemo">
                      <div class="accordion">
                        <div class="accordionBody" style="display:block;">
                          <div class="small" style="margin-bottom:6px;">Text or JSON to base64 (UTF-8).</div>
                          <textarea style="height:80px;" placeholder="Input text or JSON"></textarea>
                          <div class="row" style="margin-top:6px;">
                            <button>Encode</button>
                            <button>Encode JSON</button>
                            <button>Copy output</button>
                          </div>
                          <textarea style="height:80px; margin-top:6px;" readonly placeholder="Base64 output"></textarea>
                        </div>
                      </div>
                    </div>
                    <ul class="guideList">
                      <li><strong>Input</strong> paste text or JSON to encode.</li>
                      <li><strong>Encode</strong> creates base64 from the input text.</li>
                      <li><strong>Encode JSON</strong> stringifies JSON then encodes it.</li>
                      <li><strong>Copy output</strong> copies the base64 result to the clipboard.</li>
                      <li><strong>Output</strong> shows the encoded base64 string.</li>
                    </ul>
                  `,
                },
              ],
            },
            {
              id: "sidebar-controls",
              title: "Controls",
              body: `
                <p>Controls groups operational toggles that adjust how Operator behaves during scanning and execution.</p>
                <div class="guideDemo guideSidebarDemo">
                  <div class="row">
                    <label class="chk">
                      <input type="checkbox" /> auto extract &amp; scan
                    </label>
                    <span class="small">interval</span>
                    <select class="guideCompactSelect">
                      <option>2s</option>
                      <option selected>3s</option>
                      <option>5s</option>
                      <option>10s</option>
                    </select>
                  </div>
                  <div class="small">Auto pauses while you interact with Command Inbox.</div>
                </div>
                <ul class="guideList">
                  <li><strong>auto extract &amp; scan</strong> runs extraction automatically on a timer.</li>
                  <li><strong>interval</strong> sets how often automatic extraction runs.</li>
                  <li><strong>Auto pauses while you interact with Command Inbox</strong> prevents updates while you're reviewing commands.</li>
                </ul>
              `,
            },
          ],
        },
      ],
    },
  ];
}

function setActiveGuideNav(id) {
  guideActiveId = id;
  if (!guideNav) return;
  const buttons = Array.from(guideNav.querySelectorAll(".guideTreeLabel"));
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.dataset.target === id);
  }
}

function buildGuideNav(nodes, container, level) {
  const state = [];
  for (const node of nodes) {
    const row = document.createElement("div");
    row.className = "guideTreeNode";
    row.style.paddingLeft = `${level * 12}px`;

    const toggle = document.createElement("button");
    toggle.className = "guideTreeToggle";

    const label = document.createElement("button");
    label.className = "guideTreeLabel";
    label.textContent = node.title;
    label.dataset.target = `guide-${node.id}`;
    label.onclick = () => {
      const target = document.getElementById(`guide-${node.id}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveGuideNav(`guide-${node.id}`);
    };

    row.appendChild(toggle);
    row.appendChild(label);
    container.appendChild(row);

    let childrenWrap = null;
    let childrenState = [];
    if (node.children && node.children.length) {
      toggle.textContent = "v";
      childrenWrap = document.createElement("div");
      childrenWrap.className = "guideTreeChildren open";
      childrenWrap.style.marginLeft = "0";
      childrenWrap.style.paddingLeft = "0";
      childrenWrap.style.setProperty("--guide-line-offset", `${level * 12}px`);
      container.appendChild(childrenWrap);
      childrenState = buildGuideNav(node.children, childrenWrap, level + 1);
      toggle.onclick = () => {
        const open = childrenWrap.classList.toggle("open");
        toggle.textContent = open ? "v" : ">";
      };
    } else {
      toggle.textContent = "";
      toggle.classList.add("empty");
      toggle.disabled = true;
    }

    state.push({
      id: node.id,
      row,
      label,
      toggle,
      childrenWrap,
      children: childrenState,
    });
  }
  return state;
}

function buildGuideContent(nodes, level) {
  if (!guideContent) return;
  for (const node of nodes) {
    const sectionEl = document.createElement("section");
    sectionEl.className = "guideSection";
    sectionEl.id = `guide-${node.id}`;
    sectionEl.dataset.level = String(level);
    sectionEl.innerHTML = `<h3>${node.title}</h3>${node.body || ""}`;
    const textContent = sectionEl.textContent || "";
    sectionEl.dataset.search = `${node.title} ${textContent}`.trim();
    guideContent.appendChild(sectionEl);
    if (node.children && node.children.length) {
      buildGuideContent(node.children, level + 1);
    }
  }
}

function updateGuideNavVisibility(nodes) {
  const hasQuery = !!(guideSearchInput && String(guideSearchInput.value || "").trim());
  let anyVisible = false;
  for (const node of nodes) {
    const section = document.getElementById(`guide-${node.id}`);
    const selfVisible = section ? section.style.display !== "none" : false;
    const childVisible = node.children && node.children.length ? updateGuideNavVisibility(node.children) : false;
    const visible = selfVisible || childVisible;
    if (node.row) node.row.style.display = visible ? "" : "none";
    if (node.childrenWrap) {
      node.childrenWrap.style.display = childVisible ? "" : "none";
      if (childVisible && node.toggle) node.toggle.textContent = "v";
      if (childVisible && hasQuery) node.childrenWrap.classList.add("open");
    }
    if (visible) anyVisible = true;
  }
  return anyVisible;
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
  updateGuideNavVisibility(guideNavState);
  if (firstVisible && firstVisible.id) setActiveGuideNav(firstVisible.id);
}

function initGuide() {
  if (!guideContent || !guideNav || guideInitialized) return;
  guideInitialized = true;
  const closeRow = guideContent.querySelector(".guideCloseRow");
  const sections = getGuideSections();
  guideNav.innerHTML = "";
  if (closeRow) guideContent.innerHTML = "";
  if (closeRow) guideContent.appendChild(closeRow);
  buildGuideContent(sections, 0);
  guideNavState = buildGuideNav(sections, guideNav, 0);
  if (guideSearchInput) {
    guideSearchInput.addEventListener("input", applyGuideSearch);
  }
  if (sections.length) setActiveGuideNav(`guide-${sections[0].id}`);
}

function openUserGuide() {
  if (!guideInitialized && window.operator?.getAppInfo) {
    window.operator.getAppInfo().then((info) => {
      window.__guideAppInfo = info || {};
      initGuide();
      applyGuideSearch();
    }).catch(() => {
      initGuide();
      applyGuideSearch();
    });
    activeOverlay = "guide";
    setOverlayState(guideOverlay, true);
    setOverlayState(gettingOverlay, false);
    setOverlayState(llmOverlay, false);
    setOverlayState(appearanceOverlay, false);
    if (guideSearchInput) {
      guideSearchInput.value = "";
      guideSearchInput.focus();
    }
    return;
  }
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
        "--icon-fg": "#1b2430",
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

if (aboutOverlay) {
  aboutOverlay.addEventListener("click", (ev) => {
    if (ev.target === aboutOverlay) closeAbout();
  });
}

if (updatesOverlay) {
  updatesOverlay.addEventListener("click", (ev) => {
    if (ev.target === updatesOverlay) closeUpdates();
  });
}

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
  else if (activeOverlay === "about") closeAbout();
  else if (activeOverlay === "updates") closeUpdates();
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

if (window.operator?.onOpenAbout) {
  window.operator.onOpenAbout(() => {
    openAbout();
  });
}

if (window.operator?.onOpenUpdates) {
  window.operator.onOpenUpdates(() => {
    openUpdates();
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
window.__openAbout = openAbout;
window.__openUpdates = openUpdates;

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

if (menuAbout) {
  menuAbout.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openAbout?.();
  };
}

if (menuCheckUpdates) {
  menuCheckUpdates.onclick = async () => {
    requestCloseMenu();
    await window.operator?.openUpdates?.();
  };
}

if (aboutClose) aboutClose.onclick = () => closeAbout();
if (aboutCloseFooter) aboutCloseFooter.onclick = () => closeAbout();
if (updatesClose) updatesClose.onclick = () => closeUpdates();
if (updatesCloseFooter) updatesCloseFooter.onclick = () => closeUpdates();
if (updatesCheck) updatesCheck.onclick = () => { void checkForUpdates(); };
if (updatesOpen) {
  updatesOpen.onclick = async () => {
    const info = await window.operator?.getAppInfo?.();
    const repoUrl = info?.repoUrl || "";
    if (repoUrl && window.operator?.openExternal) {
      window.operator.openExternal(`${repoUrl.replace(/\\.git$/i, "")}/releases`).catch(() => {});
    }
  };
}
