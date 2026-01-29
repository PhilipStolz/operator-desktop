// renderer/renderer.js

const $ = (id) => document.getElementById(id);

const btnWorkspace = $("btnWorkspace");
const workspaceEl = $("workspace");
const btnExtract = $("btnExtract");
const btnClear = $("btnClear");
const statusEl = $("status");
const actionsSection = $("actionsSection");
const topbarWorkspaceEl = $("topbarWorkspace");
const btnGettingStarted = $("btnGettingStarted");
const errorsSection = $("errorsSection");
const errorsSummary = $("errorsSummary");
const errorListEl = $("errorList");
const resultsSection = $("resultsSection");
const inboxSection = $("inboxSection");
const toolsSection = $("toolsSection");
const settingsSection = $("settingsSection");
const inboxEl = $("inbox");
const resultEl = $("result");
const btnCopyResult = $("btnCopyResult");
const btnCopyDecoded = $("btnCopyDecoded");
const copyStatusEl = $("copyStatus");
const btnCopyBootstrap = $("btnCopyBootstrap");
const llmProfileSelect = $("llmProfile");
const base64Box = $("base64Box");
const base64Body = $("base64Body");
const base64Input = $("base64Input");
const base64Output = $("base64Output");
const btnBase64Encode = $("btnBase64Encode");
const btnBase64EncodeJson = $("btnBase64EncodeJson");
const btnBase64Copy = $("btnBase64Copy");
const chkAutoScan = $("chkAutoScan");
const autoScanInterval = $("autoScanInterval");
const autoScanHintEl = $("autoScanHint");
const sidebarResizeHandle = $("sidebarResizeHandle");
const inboxResizeHandle = $("inboxResizeHandle");
const cmdModalOverlay = $("cmdModalOverlay");
const cmdModalTitle = $("cmdModalTitle");
const cmdModalClose = $("cmdModalClose");
const cmdModalJson = $("cmdModalJson");
const cmdModalDecoded = $("cmdModalDecoded");
const cmdModalDecodedSection = $("cmdModalDecodedSection");
const cmdModalStatus = $("cmdModalStatus");
const cmdModalExecute = $("cmdModalExecute");
const cmdModalDismiss = $("cmdModalDismiss");
const cmdModalToggleDecoded = $("cmdModalToggleDecoded");
const resetStatusEl = $("resetStatus");

const chkStopOnFail = $("chkStopOnFail");
const chkAutoCopy = $("chkAutoCopy");

let commands = [];
let errorItems = [];
let lastResultText = "";
let selectedKeys = new Set();
let pendingFocusKey = null;

const EXECUTED_KEY = "operator.executedIds.v1";
let executedIds = new Set();

const AUTO_SCAN_KEY = "operator.autoScan.v1";
const AUTO_SCAN_INTERVAL_KEY = "operator.autoScanIntervalMs.v1";
const WORKSPACE_KEY = "operator.workspaceRoot.v1";
let autoScanTimer = null;
let autoScanPaused = false;
let scanInFlight = false;
let inboxResizing = false;
let lastErrorCount = 0;

const SIDEBAR_WIDTH_KEY = "operator.sidebarWidth.v1";
const INBOX_HEIGHT_KEY = "operator.inboxHeight.v1";
const BASE64_COLLAPSED_KEY = "operator.base64Collapsed.v1";
const ACCORDION_ACTIONS_KEY = "operator.accordion.actions.v1";
const ACCORDION_ERRORS_KEY = "operator.accordion.errors.v1";
const ACCORDION_INBOX_KEY = "operator.accordion.inbox.v1";
const ACCORDION_TOOLS_KEY = "operator.accordion.tools.v1";
const ACCORDION_RESULTS_KEY = "operator.accordion.results.v1";
const ACCORDION_SETTINGS_KEY = "operator.accordion.settings.v1";

const FALLBACK_LLM_PROFILES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "deepseek", label: "DeepSeek" },
];

let modalCmd = null;
let modalKey = null;
let modalDecodedVisible = false;

function loadExecutedIds() {
  try {
    const raw = localStorage.getItem(EXECUTED_KEY);
    if (!raw) {
      executedIds = new Set();
      return;
    }
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) executedIds = new Set(arr.map(String));
    else executedIds = new Set();
  } catch {
    executedIds = new Set();
  }
}

function saveExecutedIds() {
  try {
    localStorage.setItem(EXECUTED_KEY, JSON.stringify([...executedIds]));
  } catch {}
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setCssVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

function applySidebarWidth(width) {
  const clamped = clamp(Math.floor(width), 260, 720);
  setCssVar("--sidebar-width", `${clamped}px`);
  if (sidebarResizeHandle) sidebarResizeHandle.style.left = `${clamped - 3}px`;
  if (window.operator && window.operator.setSidebarWidth) {
    window.operator.setSidebarWidth(clamped);
  }
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  } catch {}
}

function applyInboxHeight(height) {
  const clamped = clamp(Math.floor(height), 120, 600);
  setCssVar("--inbox-height", `${clamped}px`);
  try {
    localStorage.setItem(INBOX_HEIGHT_KEY, String(clamped));
  } catch {}
}

function loadLayoutSettings() {
  try {
    const width = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(width)) applySidebarWidth(width);
    else applySidebarWidth(360);
  } catch {
    applySidebarWidth(360);
  }

  try {
    const height = Number(localStorage.getItem(INBOX_HEIGHT_KEY));
    if (Number.isFinite(height)) applyInboxHeight(height);
    else applyInboxHeight(220);
  } catch {
    applyInboxHeight(220);
  }
}

function setAccordionOpenTransient(detailsEl, open) {
  if (!detailsEl) return;
  if (detailsEl.open === !!open) return;
  detailsEl.dataset.suppressSave = "1";
  detailsEl.open = !!open;
}

function loadAccordionState(detailsEl, key, defaultOpen) {
  if (!detailsEl) return;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) detailsEl.open = !!defaultOpen;
    else detailsEl.open = stored === "true";
  } catch {
    detailsEl.open = !!defaultOpen;
  }
  detailsEl.addEventListener("toggle", () => {
    if (detailsEl.dataset.suppressSave === "1") {
      delete detailsEl.dataset.suppressSave;
      return;
    }
    try {
      localStorage.setItem(key, detailsEl.open ? "true" : "false");
    } catch {}
  });
}

function setBase64Collapsed(collapsed) {
  if (!base64Box) return;
  base64Box.open = !collapsed;
  try {
    localStorage.setItem(BASE64_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {}
}

function loadBase64Collapsed() {
  try {
    const collapsed = localStorage.getItem(BASE64_COLLAPSED_KEY);
    if (collapsed === null) {
      setBase64Collapsed(true);
    } else {
      setBase64Collapsed(collapsed === "true");
    }
  } catch {
    setBase64Collapsed(true);
  }
}

function preserveSidebarScroll(updateFn) {
  const sidebar = document.querySelector(".sidebar") || $("sidebar");
  if (!sidebar) return updateFn();
  const prevTop = sidebar.scrollTop;
  const prevHeight = sidebar.scrollHeight;
  let result;
  try {
    result = updateFn();
  } finally {
    const restore = () => {
      const nextHeight = sidebar.scrollHeight;
      const delta = nextHeight - prevHeight;
      sidebar.scrollTop = prevTop + delta;
    };
    if (result && typeof result.then === "function") {
      result.finally(() => requestAnimationFrame(restore));
    } else {
      requestAnimationFrame(restore);
    }
  }
  return result;
}

async function loadWorkspaceFromStorage() {
  if (!window.operator?.setWorkspace) return;
  try {
    const stored = localStorage.getItem(WORKSPACE_KEY);
    if (!stored) return;
    const res = await window.operator.setWorkspace(stored);
    if (res?.ok) return { ok: true };
    const reason = res?.error ? ` (${res.error})` : "";
    try {
      localStorage.removeItem(WORKSPACE_KEY);
    } catch {}
    return { ok: false, error: `Workspace restore failed: ${stored}${reason}` };
  } catch (e) {
    try {
      localStorage.removeItem(WORKSPACE_KEY);
    } catch {}
    return { ok: false, error: `Workspace restore failed: ${String(e)}` };
  }
}

function isInboxInteracting() {
  if (!inboxEl) return false;
  if (cmdModalOverlay && cmdModalOverlay.classList.contains("open")) return true;
  if (inboxResizing) return true;
  const active = document.activeElement;
  const hasFocus = active ? inboxEl.contains(active) : false;
  const hovering = typeof inboxEl.matches === "function" ? inboxEl.matches(":hover") : false;
  return hasFocus || hovering;
}

function setAutoScanPaused(paused) {
  if (autoScanPaused === paused) return;
  autoScanPaused = paused;
  if (autoScanHintEl) {
    if (paused) {
      autoScanHintEl.textContent = "Auto scan paused (inbox interaction).";
      autoScanHintEl.style.display = "block";
    } else {
      autoScanHintEl.textContent = "";
      autoScanHintEl.style.display = "none";
    }
  }
  if (paused) setStatus("Auto scan paused (inbox interaction).");
}

function getAutoScanIntervalMs() {
  const raw = autoScanInterval ? Number(autoScanInterval.value) : NaN;
  if (!Number.isFinite(raw)) return 3000;
  return Math.max(1000, Math.floor(raw));
}

function saveAutoScanSettings() {
  try {
    if (chkAutoScan) localStorage.setItem(AUTO_SCAN_KEY, chkAutoScan.checked ? "true" : "false");
    if (autoScanInterval) localStorage.setItem(AUTO_SCAN_INTERVAL_KEY, String(getAutoScanIntervalMs()));
  } catch {}
}

function loadAutoScanSettings() {
  try {
    const enabled = localStorage.getItem(AUTO_SCAN_KEY) === "true";
    if (chkAutoScan) chkAutoScan.checked = enabled;
    const intervalRaw = Number(localStorage.getItem(AUTO_SCAN_INTERVAL_KEY));
    if (autoScanInterval && Number.isFinite(intervalRaw)) {
      const options = Array.from(autoScanInterval.options || []);
      const match = options.find((opt) => Number(opt.value) === intervalRaw);
      if (match) autoScanInterval.value = match.value;
    }
  } catch {}
}

function stopAutoScan() {
  if (autoScanTimer) clearInterval(autoScanTimer);
  autoScanTimer = null;
  setAutoScanPaused(false);
}

function startAutoScan() {
  stopAutoScan();
  const interval = getAutoScanIntervalMs();
  autoScanTimer = setInterval(() => {
    void maybeAutoScan();
  }, interval);
  void maybeAutoScan();
}

function setupSidebarResize() {
  if (!sidebarResizeHandle) return;
  let dragging = false;

  const onMove = (ev) => {
    if (!dragging) return;
    applySidebarWidth(ev.clientX);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  sidebarResizeHandle.addEventListener("mousedown", (ev) => {
    dragging = true;
    document.body.style.userSelect = "none";
    applySidebarWidth(ev.clientX);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

function setupInboxResize() {
  if (!inboxResizeHandle || !inboxEl) return;
  let dragging = false;
  let startY = 0;
  let startHeight = 0;

  const onMove = (ev) => {
    if (!dragging) return;
    const next = startHeight + (ev.clientY - startY);
    applyInboxHeight(next);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    inboxResizing = false;
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  inboxResizeHandle.addEventListener("mousedown", (ev) => {
    dragging = true;
    inboxResizing = true;
    document.body.style.userSelect = "none";
    startY = ev.clientY;
    const current = getComputedStyle(inboxEl).height;
    startHeight = Number.parseFloat(current) || 220;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

function commandKey(cmd, index) {
  if (cmd && cmd.id) return `id:${cmd.id}`;
  return `idx:${index}`;
}

function isSelected(key) {
  return selectedKeys.has(key);
}

function setSelected(key, value) {
  if (value) selectedKeys.add(key);
  else selectedKeys.delete(key);
}

function selectFocusAfterScan() {
  if (!commands.length) {
    selectedKeys = new Set();
    pendingFocusKey = null;
    return;
  }

  let lastExecutedIndex = -1;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd && cmd.id && executedIds.has(String(cmd.id))) {
      lastExecutedIndex = i;
    }
  }

  let focusIndex = -1;
  for (let i = commands.length - 1; i > lastExecutedIndex; i--) {
    const cmd = commands[i];
    const executed = cmd && cmd.id && executedIds.has(String(cmd.id));
    if (!executed) {
      focusIndex = i;
      break;
    }
  }

  if (focusIndex === -1) focusIndex = commands.length - 1;

  const key = commandKey(commands[focusIndex], focusIndex);
  selectedKeys = new Set([key]);
  pendingFocusKey = key;
}

const btnResetExecuted = $("btnResetExecuted");
if (btnResetExecuted) {
  btnResetExecuted.onclick = () => {
    executedIds = new Set();
    saveExecutedIds();
    renderInbox();
    if (resetStatusEl) {
      resetStatusEl.textContent = "Reset.";
      setTimeout(() => {
        if (resetStatusEl) resetStatusEl.textContent = "";
      }, 1200);
    }
  };
}

if (btnGettingStarted) {
  btnGettingStarted.onclick = () => {
    // handled in topbar view
  };
}

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setTopbarWorkspace(text) {
  if (!topbarWorkspaceEl) return;
  topbarWorkspaceEl.textContent = text || "Workspace: (not set)";
}

function buildErrorItems(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const now = Date.now();
  return list.map((message, index) => {
    const text = String(message ?? "");
    const relatedId = extractRelatedId(text);
    const payload = relatedId ? { message: text, related_id: relatedId } : { message: text };
    return {
      id: `error-${now}-${index + 1}`,
      message: text,
      related_id: relatedId || "",
      details_b64: toBase64(JSON.stringify(payload)),
    };
  });
}

async function copyErrorResult(item) {
  if (!item || !window.operator?.copyToClipboard) return;
  const lines = [
    "OPERATOR_RESULT",
    item.id ? `id: ${item.id}` : null,
    "ok: false",
    `summary: ${item.message}`,
    `details_b64: ${item.details_b64}`,
    "END_OPERATOR_RESULT",
  ].filter(Boolean);
  const text = lines.join("\n");
  try {
    await window.operator.copyToClipboard(text);
    copyStatusEl.textContent = "Copied error result.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1200);
  } catch (e) {
    copyStatusEl.textContent = `Copy failed: ${String(e)}`;
    setTimeout(() => (copyStatusEl.textContent = ""), 1600);
  }
}

function renderErrors() {
  if (!errorsSummary || !errorsSection || !errorListEl) return;
  const count = errorItems.length;
  errorsSummary.textContent = `Errors (${count})`;
  errorListEl.innerHTML = "";

  if (count === 0) {
    setAccordionOpenTransient(errorsSection, false);
    lastErrorCount = 0;
    return;
  }

  let pref = null;
  try {
    pref = localStorage.getItem(ACCORDION_ERRORS_KEY);
  } catch {}

  if (pref === "false") {
    setAccordionOpenTransient(errorsSection, false);
  } else if (pref === "true") {
    setAccordionOpenTransient(errorsSection, true);
  } else if (lastErrorCount === 0) {
    setAccordionOpenTransient(errorsSection, true);
  }
  lastErrorCount = count;

  for (const item of errorItems) {
    const card = document.createElement("div");
    card.className = "errorCard";

    const message = document.createElement("div");
    message.className = "errorMessage";
    message.textContent = item.message;
    card.appendChild(message);

    if (item.related_id) {
      const meta = document.createElement("div");
      meta.className = "errorMeta";
      meta.textContent = `related: ${item.related_id}`;
      card.appendChild(meta);
    }

    const actions = document.createElement("div");
    actions.className = "errorActions";

    const btnCopy = document.createElement("button");
    btnCopy.textContent = "Copy result";
    btnCopy.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      copyErrorResult(item);
    };

    const btnDismiss = document.createElement("button");
    btnDismiss.textContent = "Dismiss";
    btnDismiss.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      errorItems = errorItems.filter((e) => e !== item);
      renderErrors();
    };

    actions.appendChild(btnCopy);
    actions.appendChild(btnDismiss);
    card.appendChild(actions);

    errorListEl.appendChild(card);
  }
}

function setErrors(messages) {
  errorItems = buildErrorItems(messages);
  renderErrors();
}

function addErrorMessage(message) {
  const items = buildErrorItems([message]);
  errorItems = errorItems.concat(items);
  renderErrors();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconSvg(kind) {
  if (kind === "details") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5c7 0 10 7 10 7s-3 7-10 7-10-7-10-7 3-7 10-7Zm0 2c-4.8 0-7.5 4.2-7.9 5 .4.8 3.1 5 7.9 5s7.5-4.2 7.9-5c-.4-.8-3.1-5-7.9-5Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"/></svg>`;
  }
  if (kind === "execute") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5v14l12-7-12-7Z"/></svg>`;
  }
  if (kind === "dismiss") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 5l12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19l-1.4-1.4L17.6 5l1.4 1.4Z"/></svg>`;
  }
  return "";
}

function createIconButton(kind, title) {
  const btn = document.createElement("button");
  btn.className = "cmdBtn";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.innerHTML = iconSvg(kind);
  return btn;
}

function decodeDetailsB64FromResultText(resultText) {
  try {
    const text = String(resultText || "");

    // Find LAST details_b64 anywhere (no OPERATOR_RESULT/line assumptions).
    // Captures the base64 token right after "details_b64:" ignoring whitespace.
    const matches = Array.from(text.matchAll(/details_b64:\s*([A-Za-z0-9+/=]+)/g));
    if (!matches.length) return { ok: false, error: "No details_b64 field found." };

    const b64 = (matches[matches.length - 1][1] || "").trim();
    if (!b64) return { ok: false, error: "details_b64 is empty." };

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const decodedText = new TextDecoder("utf-8").decode(bytes);
    return { ok: true, decodedText };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function extractRelatedId(message) {
  if (!message) return "";
  const m = String(message).match(/id\s*[:=]\s*([A-Za-z0-9._-]+)/i);
  return m ? m[1] : "";
}



function decodeBase64Value(value) {
  try {
    const trimmed = String(value || "").trim();
    if (!trimmed) return { ok: false, error: "empty" };
    const bin = atob(trimmed);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decodedText = new TextDecoder("utf-8").decode(bytes);
    return { ok: true, decodedText };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function decodeBase64Fields(cmd) {
  if (!cmd || typeof cmd !== "object") return "";
  const lines = [];
  for (const [key, value] of Object.entries(cmd)) {
    if (!key.endsWith("_b64") || typeof value !== "string") continue;
    const res = decodeBase64Value(value);
    lines.push(`${key}:`);
    lines.push(res.ok ? res.decodedText : `<<decode failed: ${res.error}>>`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function setModalDecodedVisibility(visible) {
  modalDecodedVisible = visible;
  if (cmdModalDecodedSection) cmdModalDecodedSection.style.display = visible ? "block" : "none";
  else if (cmdModalDecoded) cmdModalDecoded.style.display = visible ? "block" : "none";
  if (cmdModalToggleDecoded) cmdModalToggleDecoded.textContent = visible ? "Hide decoded" : "Show decoded";
}

function openCommandModal(cmd, key) {
  if (!cmdModalOverlay || !cmdModalJson || !cmdModalTitle) return;
  modalCmd = cmd;
  modalKey = key;
  const executed = cmd?.id && executedIds.has(String(cmd.id));
  if (cmd && (cmd.action || cmd.id)) {
    const action = cmd.action || "(no action)";
    cmdModalTitle.textContent = cmd.id ? `Command: ${action} (${cmd.id})` : `Command: ${action}`;
  } else {
    cmdModalTitle.textContent = "Command";
  }
  if (cmdModalStatus) {
    cmdModalStatus.textContent = `Status: ${executed ? "executed" : "not run"}`;
  }
  cmdModalJson.textContent = JSON.stringify(cmd, null, 2);
  if (cmdModalDecoded) {
    const decoded = decodeBase64Fields(cmd);
    cmdModalDecoded.textContent = decoded ? decoded : "(no base64 fields)";
  }
  setModalDecodedVisibility(false);
  cmdModalOverlay.classList.add("open");
  cmdModalOverlay.setAttribute("aria-hidden", "false");
}

function closeCommandModal() {
  if (!cmdModalOverlay) return;
  cmdModalOverlay.classList.remove("open");
  cmdModalOverlay.setAttribute("aria-hidden", "true");
  modalCmd = null;
  modalKey = null;
  setModalDecodedVisibility(false);
}

function renderInbox() {
  inboxEl.innerHTML = "";

  if (!commands.length) {
    inboxEl.innerHTML = `<div class="small">No commands detected.</div>`;
    return;
  }

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const key = commandKey(cmd, i);
    const executed = !!(cmd.id && executedIds.has(cmd.id));
    const selected = isSelected(key);
    const div = document.createElement("div");
    const statusClass = executed ? "executed" : "pending";
    const classes = ["cmd", "cmdCompact", statusClass];
    if (selected) classes.push("active");
    div.className = classes.join(" ");
    div.onclick = (ev) => {
      const tag = ev?.target?.tagName;
      if (tag === "BUTTON" || tag === "INPUT") return;
      const next = !isSelected(key);
      setSelected(key, next);
      div.classList.toggle("active", next);
      setStatus(`Selected: ${cmd.id || cmd.action || "(command)"}`);
    };

    const line = document.createElement("div");
    line.className = "cmdLine";

    const left = document.createElement("div");
    left.className = "cmdLeft";

    const selectBox = document.createElement("input");
    selectBox.type = "checkbox";
    selectBox.checked = selected;
    selectBox.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      setSelected(key, selectBox.checked);
      if (selectBox.checked) div.classList.add("active");
      else div.classList.remove("active");
    };

    const statusIcon = document.createElement("span");
    statusIcon.className = `cmdStatusIcon ${executed ? "executed" : "pending"}`;
    statusIcon.title = executed ? "Executed" : "Not run";

    const selectCol = document.createElement("div");
    selectCol.className = "cmdSelectCol";
    selectCol.appendChild(selectBox);
    selectCol.appendChild(statusIcon);
    const textWrap = document.createElement("div");
    textWrap.className = "cmdLeftText";

    const idText = document.createElement("div");
    idText.className = "cmdId";
    idText.textContent = cmd.id || "(no id)";

    const title = document.createElement("div");
    title.className = "cmdMeta";
    title.textContent = cmd.action || "(no action)";

    textWrap.appendChild(idText);
    textWrap.appendChild(title);

    left.appendChild(selectCol);
    left.appendChild(textWrap);

    const right = document.createElement("div");
    right.className = "cmdRight";

    const btnDetails = createIconButton("details", "Details");
    btnDetails.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      openCommandModal(cmd, key);
    };

    const btnExec = createIconButton("execute", "Execute");
    btnExec.onclick = async (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      await runCommands([{ cmd, key }]);
    };

    const btnDrop = createIconButton("dismiss", "Dismiss");
    btnDrop.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      commands = commands.filter((c) => c !== cmd);
      selectedKeys.delete(key);
      renderInbox();
    };

    right.appendChild(btnDetails);
    right.appendChild(btnExec);
    right.appendChild(btnDrop);

    line.appendChild(left);
    line.appendChild(right);
    div.appendChild(line);
    inboxEl.appendChild(div);

    if (pendingFocusKey && key === pendingFocusKey) {
      pendingFocusKey = null;
      if (div.scrollIntoView) div.scrollIntoView({ block: "nearest" });
    }
  }
}

async function applyScanResults(scan, auto) {
  if (auto && isInboxInteracting()) {
    setAutoScanPaused(true);
    return;
  }

  const applyUpdates = () => {
    setAutoScanPaused(false);
    const errors = scan?.errors || [];
    commands = scan?.commands || [];
    selectFocusAfterScan();
    setErrors(errors);
    renderInbox();
    setStatus(`Scan done. Commands: ${commands.length}`);
  };

  preserveSidebarScroll(applyUpdates);
}

async function scanFromExtract(auto) {
  if (scanInFlight) {
    if (!auto) setStatus("Scan already in progress.");
    return;
  }
  if (auto && isInboxInteracting()) {
    setAutoScanPaused(true);
    return;
  }

  scanInFlight = true;
  try {
    if (!auto) setErrors([]);
    setStatus(auto ? "Auto extracting..." : "Extracting...");

    const extracted = await window.operator.extract();
    const text = extracted?.text || "";
    setStatus(`${auto ? "Auto scanning" : "Scanning"}... (${text.length.toLocaleString()} chars)`);

    const scan = await window.operator.scan(text);
    await applyScanResults(scan, auto);
  } catch (e) {
    setStatus(auto ? "Auto extraction failed." : "Extraction failed.");
    setErrors([String(e)]);
  } finally {
    scanInFlight = false;
  }
}

async function scanClipboard() {
  if (scanInFlight) {
    setStatus("Scan already in progress.");
    return;
  }

  scanInFlight = true;
  setErrors([]);
  setStatus("Reading clipboard...");

  try {
    const clip = await window.operator.readClipboard();
    const text = clip?.text || "";
    setStatus(`Scanning clipboard... (${text.length.toLocaleString()} chars)`);
    const scan = await window.operator.scan(text);
    await applyScanResults(scan, false);
  } catch (e) {
    setStatus("Clipboard scan failed.");
    setErrors([String(e)]);
  } finally {
    scanInFlight = false;
  }
}

async function maybeAutoScan() {
  if (!chkAutoScan || !chkAutoScan.checked) return;
  if (scanInFlight) return;
  await scanFromExtract(true);
}

function listCommandEntries() {
  const entries = [];
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    entries.push({ cmd, key: commandKey(cmd, i) });
  }
  return entries;
}

function getSelectedEntries() {
  return listCommandEntries().filter((entry) => selectedKeys.has(entry.key));
}

async function executeCommand(cmd) { // JSON.parse related_id
  try {
    const parseJson = JSON.parse;
    const relatedMarker = "JSON.parse related_id";
    if (cmd && cmd.action === "operator.error") {
      // JSON.parse(details_b64) to read related_id for OPERATOR_RESULT id.
      const summary = cmd._message ? String(cmd._message) : "Operator error";
      const details = typeof cmd.details_b64 === "string"
        ? cmd.details_b64
        : toBase64(JSON.stringify({ message: "Unknown issue" }));
      let relatedId = "";
      if (typeof details === "string") {
        try {
          const bin = atob(details.trim());
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const decodedText = new TextDecoder("utf-8").decode(bytes);
          const payload = parseJson(decodedText);
          if (payload && typeof payload.related_id === "string") {
            relatedId = payload.related_id;
          }
        } catch {}
      }
      const okValue = "false";
      const lines = [
        "OPERATOR_RESULT",
        relatedId ? `id: ${relatedId}` : (cmd.id ? `id: ${cmd.id}` : null),
        `ok: ${okValue}`,
        `summary: ${summary}`,
        `details_b64: ${details}`,
        "END_OPERATOR_RESULT",
      ].filter(Boolean);

      if (cmd.id) {
        executedIds.add(String(cmd.id));
        saveExecutedIds();
      }
      return { ok: false, resultText: lines.join("\n") };
    }
    const res = await window.operator.execute(cmd);
    const ok = !!res?.result?.ok;
    if (ok && cmd.id) {
      executedIds.add(String(cmd.id));
      saveExecutedIds();
    }
    return { ok, resultText: res?.resultText || "" };
  } catch (e) {
    return { ok: false, resultText: String(e) };
  }
}

async function runCommands(entries) {
  if (!entries || entries.length === 0) {
    setStatus("No commands selected.");
    return;
  }

  const results = [];
  let failed = false;

  for (let i = 0; i < entries.length; i++) {
    const { cmd } = entries[i];
    setStatus(`Executing ${i + 1}/${entries.length}...`);
    const res = await executeCommand(cmd);
    if (res.resultText) results.push(res.resultText);
    if (!res.ok) {
      failed = true;
      if (chkStopOnFail && chkStopOnFail.checked) break;
    }
  }

  if (results.length > 0) {
    const joined = results.join("\n\n");
    lastResultText = joined;
    resultEl.value = joined;
    if (chkAutoCopy && chkAutoCopy.checked) {
      await window.operator.copyToClipboard(joined);
      copyStatusEl.textContent = "Copied.";
      setTimeout(() => (copyStatusEl.textContent = ""), 1200);
    }
  }

  renderInbox();
  setStatus(failed ? "Done with failures." : "Done.");
}

async function refreshWorkspacePill() {
  try {
    const res = await window.operator.getWorkspace?.();
    const root = res?.workspaceRoot;
    const text = root ? `Workspace: ${root}` : "Workspace: (not set)";
    if (workspaceEl) workspaceEl.textContent = text;
    setTopbarWorkspace(text);
  } catch {
    if (workspaceEl) workspaceEl.textContent = "Workspace: (unknown)";
    setTopbarWorkspace("Workspace: (unknown)");
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
    setErrors(["LLM list unavailable from backend. Using fallback list."]);
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
      if (active?.id) {
        const option = document.createElement("option");
        option.value = active.id;
        option.textContent = active.label || active.id;
        llmProfileSelect.appendChild(option);
        llmProfileSelect.value = active.id;
        return;
      }
      for (const profile of FALLBACK_LLM_PROFILES) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.label || profile.id;
        llmProfileSelect.appendChild(option);
      }
      llmProfileSelect.value = FALLBACK_LLM_PROFILES[0]?.id ?? "";
      setErrors(["No LLM profiles available from backend. Using fallback list."]);
    }
  } catch (e) {
    setErrors([`Failed to load LLM profiles: ${String(e)}`]);
  }
}

if (llmProfileSelect) {
  llmProfileSelect.onchange = async () => {
    const id = llmProfileSelect.value;
    if (!id) return;
    if (!window.operator?.setLlmProfile) {
      addErrorMessage("LLM switch unavailable: operator.setLlmProfile missing.");
      return;
    }
    setStatus("Switching LLM...");
    try {
      const res = await window.operator.setLlmProfile(id);
      if (res?.ok) {
        const label = res?.label || id;
        setStatus(`LLM set: ${label}.`);
      } else {
        const msg = res?.error ? `Failed to set LLM: ${res.error}` : "Failed to set LLM.";
        setStatus(msg);
        addErrorMessage(msg);
      }
    } catch (e) {
      setStatus("Failed to set LLM.");
      addErrorMessage(String(e));
    }
  };
}

if (settingsSection) {
  settingsSection.addEventListener("toggle", () => {
    if (!settingsSection.open) return;
    if (!llmProfileSelect) return;
    if (llmProfileSelect.options.length === 0) {
      loadLlmProfiles();
    }
  });
}

if (llmProfileSelect) {
  llmProfileSelect.addEventListener("focus", () => {
    if (llmProfileSelect.options.length === 0) {
      loadLlmProfiles();
    }
  });
}

if (btnWorkspace) {
  btnWorkspace.onclick = async () => {
    setStatus("Choosing workspace...");
    const res = await window.operator.chooseWorkspace();
    if (res?.ok && res.workspaceRoot) {
      try {
        localStorage.setItem(WORKSPACE_KEY, res.workspaceRoot);
      } catch {}
    }
    await refreshWorkspacePill();
    loadExecutedIds();
    setStatus(res?.ok ? "Workspace set." : "Workspace not changed.");
  };
}

const btnScanClipboard = $("btnScanClipboard");

btnScanClipboard.onclick = async () => {
  await scanClipboard();
};

btnExtract.onclick = async () => {
  await scanFromExtract(false);
};

if (chkAutoScan) {
  chkAutoScan.onchange = () => {
    saveAutoScanSettings();
    if (chkAutoScan.checked) startAutoScan();
    else stopAutoScan();
  };
}

if (autoScanInterval) {
  autoScanInterval.onchange = () => {
    saveAutoScanSettings();
    if (chkAutoScan && chkAutoScan.checked) startAutoScan();
  };
}

if (base64Box) {
  base64Box.addEventListener("toggle", () => {
    try {
      localStorage.setItem(BASE64_COLLAPSED_KEY, base64Box.open ? "false" : "true");
    } catch {}
  });
}

if (cmdModalClose) {
  cmdModalClose.onclick = () => {
    closeCommandModal();
  };
}

if (cmdModalOverlay) {
  cmdModalOverlay.onclick = (ev) => {
    if (ev.target === cmdModalOverlay) closeCommandModal();
  };
}

if (cmdModalToggleDecoded) {
  cmdModalToggleDecoded.onclick = () => {
    setModalDecodedVisibility(!modalDecodedVisible);
  };
}

if (cmdModalExecute) {
  cmdModalExecute.onclick = async () => {
    if (!modalCmd) return;
    await runCommands([{ cmd: modalCmd, key: modalKey || "" }]);
    closeCommandModal();
  };
}

if (cmdModalDismiss) {
  cmdModalDismiss.onclick = () => {
    if (!modalCmd) return;
    commands = commands.filter((c) => c !== modalCmd);
    if (modalKey) selectedKeys.delete(modalKey);
    closeCommandModal();
    renderInbox();
  };
}

btnClear.onclick = () => {
  commands = [];
  lastResultText = "";
  selectedKeys = new Set();
  inboxEl.innerHTML = "";
  resultEl.value = "";
  setErrors([]);
  setStatus("");
  copyStatusEl.textContent = "";
  renderInbox();
};

btnCopyBootstrap.onclick = async () => {
  setStatus("Loading bootstrap prompt...");
  try {
    const res = await window.operator.getBootstrapPrompt();
    const text = res?.text || "";
    if (!text.trim()) {
      setStatus("Bootstrap prompt is empty (missing file?).");
      return;
    }
    await window.operator.copyToClipboard(text);
    const label = res?.profileLabel || res?.profileId || "";
    setStatus(label ? `Bootstrap prompt copied (${label}). Paste it into the new chat.` : "Bootstrap prompt copied. Paste it into the new chat.");
    copyStatusEl.textContent = label ? `Copied bootstrap prompt (${label}).` : "Copied bootstrap prompt.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1200);
  } catch (e) {
    setStatus("Failed to copy bootstrap prompt.");
    setErrors([String(e)]);
  }
};

if (btnBase64Encode && base64Input && base64Output) {
  btnBase64Encode.onclick = () => {
    const input = base64Input.value || "";
    base64Output.value = toBase64(input);
    setStatus("Base64 encoded.");
  };
}

if (btnBase64EncodeJson && base64Input && base64Output) {
  btnBase64EncodeJson.onclick = () => {
    const input = base64Input.value || "";
    try {
      const parsed = JSON.parse(input);
      const normalized = JSON.stringify(parsed);
      base64Output.value = toBase64(normalized);
      setStatus("JSON encoded.");
    } catch (e) {
      setStatus("Invalid JSON.");
      setErrors([String(e)]);
    }
  };
}

if (btnBase64Copy && base64Output) {
  btnBase64Copy.onclick = async () => {
    const text = base64Output.value || "";
    if (!text) {
      copyStatusEl.textContent = "No base64 to copy.";
      return;
    }
    await window.operator.copyToClipboard(text);
    copyStatusEl.textContent = "Copied base64.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1200);
  };
}

btnCopyResult.onclick = async () => {
  if (!lastResultText) {
    copyStatusEl.textContent = "No result to copy.";
    return;
  }
  await window.operator.copyToClipboard(lastResultText);
  copyStatusEl.textContent = "Copied.";
  setTimeout(() => (copyStatusEl.textContent = ""), 1200);
};

btnCopyDecoded.onclick = async () => {
  const sourceText = resultEl.value || lastResultText || "";
  const decoded = decodeDetailsB64FromResultText(sourceText);

  if (!decoded.ok) {
    copyStatusEl.textContent = decoded.error || "Nothing to decode.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1600);
    return;
  }

  await window.operator.copyToClipboard(decoded.decodedText);
  copyStatusEl.textContent = "Copied decoded details_b64.";
  setTimeout(() => (copyStatusEl.textContent = ""), 1200);
};

// boot
(async () => {
  window.addEventListener("error", (event) => {
    const message = event?.error?.stack || event?.message || "Unknown error";
    addErrorMessage(`UI error: ${message}`);
    setStatus("UI error detected.");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason?.stack || String(reason || "Unknown rejection");
    addErrorMessage(`UI rejection: ${message}`);
    setStatus("UI error detected.");
  });
  loadAccordionState(errorsSection, ACCORDION_ERRORS_KEY, false);
  loadAccordionState(actionsSection, ACCORDION_ACTIONS_KEY, true);
  loadAccordionState(inboxSection, ACCORDION_INBOX_KEY, true);
  loadAccordionState(toolsSection, ACCORDION_TOOLS_KEY, false);
  loadAccordionState(resultsSection, ACCORDION_RESULTS_KEY, false);
  loadAccordionState(settingsSection, ACCORDION_SETTINGS_KEY, false);
  loadBase64Collapsed();
  const restore = await loadWorkspaceFromStorage();
  if (restore && restore.ok === false && restore.error) {
    setErrors([restore.error]);
    setStatus("Workspace restore failed.");
  }
  await refreshWorkspacePill();
  loadExecutedIds();
  await loadLlmProfiles();
  loadLayoutSettings();
  setupSidebarResize();
  setupInboxResize();
  loadAutoScanSettings();
  if (chkAutoScan && chkAutoScan.checked) startAutoScan();
  renderInbox();
  renderErrors();
})();
