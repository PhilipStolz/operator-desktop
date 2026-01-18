// renderer/renderer.js

const $ = (id) => document.getElementById(id);

const btnWorkspace = $("btnWorkspace");
const workspaceEl = $("workspace");
const btnExtract = $("btnExtract");
const btnClear = $("btnClear");
const statusEl = $("status");
const warningsEl = $("warnings");
const inboxEl = $("inbox");
const resultEl = $("result");
const btnCopyResult = $("btnCopyResult");
const btnCopyDecoded = $("btnCopyDecoded");
const copyStatusEl = $("copyStatus");
const btnCopyBootstrap = $("btnCopyBootstrap");
const btnCopySmokeTest = $("btnCopySmokeTest");
const llmProfileSelect = $("llmProfile");
const templateSelect = $("templateSelect");
const btnInsertTemplate = $("btnInsertTemplate");
const base64Input = $("base64Input");
const base64Output = $("base64Output");
const btnBase64Encode = $("btnBase64Encode");
const btnBase64EncodeJson = $("btnBase64EncodeJson");
const btnBase64Copy = $("btnBase64Copy");

const btnSelectAll = $("btnSelectAll");
const btnSelectNone = $("btnSelectNone");
const btnRunSelected = $("btnRunSelected");
const btnRunAll = $("btnRunAll");
const chkStopOnFail = $("chkStopOnFail");
const chkAutoCopy = $("chkAutoCopy");

let commands = [];
let lastResultText = "";
let selectedKeys = new Set();
let pendingFocusKey = null;

const EXECUTED_KEY = "operator.executedIds.v1";
let executedIds = new Set();

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
    setStatus("Executed cache reset.");
  };
}

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setWarnings(warns) {
  if (!warns || warns.length === 0) {
    warningsEl.textContent = "";
    return;
  }
  warningsEl.textContent = warns.join(" | ");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

const TEMPLATES = {
  "operator.getInterfaceSpec": [
    "OPERATOR_CMD",
    "version: 1",
    "id: iface-001",
    "action: operator.getInterfaceSpec",
    "END_OPERATOR_CMD",
  ].join("\n"),
  "fs.list": [
    "OPERATOR_CMD",
    "version: 1",
    "id: list-001",
    "action: fs.list",
    "path: .",
    "END_OPERATOR_CMD",
  ].join("\n"),
  "fs.readSlice": [
    "OPERATOR_CMD",
    "version: 1",
    "id: readslice-001",
    "action: fs.readSlice",
    "path: path/to/file.txt",
    "start: 1",
    "lines: 120",
    "END_OPERATOR_CMD",
  ].join("\n"),
  "fs.search": [
    "OPERATOR_CMD",
    "version: 1",
    "id: search-001",
    "action: fs.search",
    "path: path/to/file.txt",
    "query: TODO",
    "END_OPERATOR_CMD",
  ].join("\n"),
  "fs.write": [
    "OPERATOR_CMD",
    "version: 1",
    "id: write-001",
    "action: fs.write",
    "path: path/to/file.txt",
    "content_b64: SGVsbG8=",
    "END_OPERATOR_CMD",
  ].join("\n"),
  "fs.applyEdits": [
    "OPERATOR_CMD",
    "version: 1",
    "id: applyedits-001",
    "action: fs.applyEdits",
    "path: path/to/file.txt",
    "edits_b64: eyJ2ZXJzaW9uIjoxLCJlZGl0cyI6W119",
    "END_OPERATOR_CMD",
  ].join("\n"),
};

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
    const classes = ["cmd"];
    if (executed) classes.push("executed");
    if (selected) classes.push("active");
    div.className = classes.join(" ");
    div.onclick = () => {
      setStatus(`Selected: ${cmd.id || cmd.action || "(command)"}`);
    };

    const header = document.createElement("div");

    const titleRow = document.createElement("div");
    titleRow.className = "row";
    const selectBox = document.createElement("input");
    selectBox.type = "checkbox";
    selectBox.checked = selected;
    selectBox.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      setSelected(key, selectBox.checked);
      if (selectBox.checked) div.classList.add("active");
      else div.classList.remove("active");
    };
    const title = document.createElement("div");
    title.innerHTML = `<strong>${escapeHtml(cmd.action || "(no action)")}</strong>`;
    titleRow.appendChild(selectBox);
    titleRow.appendChild(title);
    header.appendChild(titleRow);

    const idLine = document.createElement("div");
    idLine.className = "small";
    idLine.textContent = `id: ${cmd.id || "(no id)"}`;

    const statusLine = document.createElement("div");
    statusLine.className = "small";
    statusLine.textContent = `status: ${executed ? "executed" : "not run"}`;

    const pathLine = document.createElement("div");
    pathLine.className = "small";
    pathLine.innerHTML = `path: <span class="mono">${escapeHtml(cmd.path || "(no path)")}</span>`;

    header.appendChild(idLine);
    header.appendChild(statusLine);
    header.appendChild(pathLine);

    const args = document.createElement("div");
    args.className = "mono";
    args.style.marginTop = "6px";
    args.textContent = JSON.stringify(cmd, null, 2);

    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "8px";

    const btnExec = document.createElement("button");
    btnExec.textContent = "Execute";
    btnExec.onclick = async (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      await runCommands([{ cmd, key }]);
    };

    const btnDrop = document.createElement("button");
    btnDrop.textContent = "Dismiss";
    btnDrop.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      commands = commands.filter((c) => c !== cmd);
      selectedKeys.delete(key);
      renderInbox();
    };

    row.appendChild(btnExec);
    row.appendChild(btnDrop);
    div.appendChild(header);
    div.appendChild(args);
    div.appendChild(row);
    inboxEl.appendChild(div);

    if (pendingFocusKey && key === pendingFocusKey) {
      pendingFocusKey = null;
      if (div.scrollIntoView) div.scrollIntoView({ block: "nearest" });
    }
  }
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

async function executeCommand(cmd) {
  try {
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
    workspaceEl.textContent = root ? `Workspace: ${root}` : "Workspace: (not set)";
  } catch {
    workspaceEl.textContent = "Workspace: (unknown)";
  }
}

if (btnSelectAll) {
  btnSelectAll.onclick = () => {
    selectedKeys = new Set(listCommandEntries().map((entry) => entry.key));
    renderInbox();
    setStatus(`Selected: ${selectedKeys.size}`);
  };
}

if (btnSelectNone) {
  btnSelectNone.onclick = () => {
    selectedKeys = new Set();
    renderInbox();
    setStatus("Selection cleared.");
  };
}

if (btnRunSelected) {
  btnRunSelected.onclick = async () => {
    await runCommands(getSelectedEntries());
  };
}

if (btnRunAll) {
  btnRunAll.onclick = async () => {
    await runCommands(listCommandEntries());
  };
}

async function loadLlmProfiles() {
  if (!llmProfileSelect || !window.operator.getLlmProfiles) return;
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
  } catch (e) {
    setWarnings([`Failed to load LLM profiles: ${String(e)}`]);
  }
}

if (llmProfileSelect) {
  llmProfileSelect.onchange = async () => {
    const id = llmProfileSelect.value;
    if (!id || !window.operator.setLlmProfile) return;
    setStatus("Switching LLM...");
    try {
      const res = await window.operator.setLlmProfile(id);
      if (res?.ok) {
        const label = res?.label || id;
        setStatus(`LLM set: ${label}.`);
      } else {
        setStatus(res?.error ? `Failed to set LLM: ${res.error}` : "Failed to set LLM.");
      }
    } catch (e) {
      setStatus("Failed to set LLM.");
      setWarnings([String(e)]);
    }
  };
}

btnWorkspace.onclick = async () => {
  setStatus("Choosing workspace...");
  const res = await window.operator.chooseWorkspace();
  await refreshWorkspacePill();
  loadExecutedIds();
  setStatus(res?.ok ? "Workspace set." : "Workspace not changed.");
};

const btnScanClipboard = $("btnScanClipboard");

btnScanClipboard.onclick = async () => {
  setWarnings([]);
  setStatus("Reading clipboard...");

  try {
    const clip = await window.operator.readClipboard();
    const text = clip?.text || "";
    setStatus(`Scanning clipboard... (${text.length.toLocaleString()} chars)`);
    const scan = await window.operator.scan(text);
    commands = scan?.commands || [];
    selectFocusAfterScan();
    setWarnings(scan?.warnings || []);
    renderInbox();
    setStatus(`Scan done. Commands: ${commands.length}`);
  } catch (e) {
    setStatus("Clipboard scan failed.");
    setWarnings([String(e)]);
  }
};

btnExtract.onclick = async () => {
  setWarnings([]);
  setStatus("Extracting...");

  try {
    const extracted = await window.operator.extract();
    const text = extracted?.text || "";
    setStatus(`Scanning... (${text.length.toLocaleString()} chars)`);
    const scan = await window.operator.scan(text);
    commands = scan?.commands || [];
    selectFocusAfterScan();
    setWarnings(scan?.warnings || []);
    renderInbox();
    setStatus(`Scan done. Commands: ${commands.length}`);
  } catch (e) {
    setStatus("Extraction failed.");
    setWarnings([String(e)]);
  }
};

btnClear.onclick = () => {
  commands = [];
  lastResultText = "";
  selectedKeys = new Set();
  inboxEl.innerHTML = "";
  resultEl.value = "";
  setWarnings([]);
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
    setWarnings([String(e)]);
  }
};

if (btnCopySmokeTest) {
  btnCopySmokeTest.onclick = async () => {
    setStatus("Loading smoke test...");
    try {
      const res = await window.operator.getSmokeTestPrompt();
      const text = res?.text || "";
      if (!text.trim()) {
        setStatus("Smoke test is empty (missing file?).");
        return;
      }
      await window.operator.copyToClipboard(text);
      setStatus("Smoke test copied. Paste it into the new chat.");
      copyStatusEl.textContent = "Copied smoke test.";
      setTimeout(() => (copyStatusEl.textContent = ""), 1200);
    } catch (e) {
      setStatus("Failed to copy smoke test.");
      setWarnings([String(e)]);
    }
  };
}

if (btnInsertTemplate && templateSelect) {
  btnInsertTemplate.onclick = async () => {
    const key = templateSelect.value;
    const text = TEMPLATES[key];
    if (!text) {
      setStatus("Unknown template.");
      return;
    }
    await window.operator.copyToClipboard(text);
    setStatus(`Template copied: ${key}.`);
    copyStatusEl.textContent = "Copied template.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1200);
  };
}

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
      setWarnings([String(e)]);
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
  await refreshWorkspacePill();
  loadExecutedIds();
  await loadLlmProfiles();
  renderInbox();
})();
