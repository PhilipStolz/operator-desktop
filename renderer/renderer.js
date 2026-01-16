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

const btnSelectAll = $("btnSelectAll");
const btnSelectNone = $("btnSelectNone");
const btnRunSelected = $("btnRunSelected");
const btnRunAll = $("btnRunAll");
const chkStopOnFail = $("chkStopOnFail");

let commands = [];
let lastResultText = "";

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setWarnings(warns) {
  if (!warns || warns.length === 0) {
    warningsEl.textContent = "";
    return;
  }
  warningsEl.textContent = warns.join("  •  ");
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
  // Find the last OPERATOR_RESULT block and decode its details_b64 (if present).
  // Returns { ok: boolean, decodedText?: string, error?: string }
  try {
    const text = String(resultText || "");
    const idx = text.lastIndexOf("OPERATOR_RESULT");
    if (idx < 0) return { ok: false, error: "No OPERATOR_RESULT block found." };

    const tail = text.slice(idx);
    const m = tail.match(/\n(?:details_b64:\\s*)([^\\n\\r]+)/);
    if (!m) return { ok: false, error: "No details_b64 field found." };

    const b64 = (m[1] || "").trim();
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

function renderInbox() {
  inboxEl.innerHTML = "";

  if (!commands.length) {
    inboxEl.innerHTML = `<div class="small">No commands detected.</div>`;
    return;
  }

  for (const cmd of commands) {
    const div = document.createElement("div");
    div.className = "cmd";

    const header = document.createElement("div");
    header.innerHTML = `
      <div><strong>${escapeHtml(cmd.action || "(no action)")}</strong></div>
      <div class="small">id: ${escapeHtml(cmd.id || "(no id)")}</div>
      <div class="small">path: <span class="mono">${escapeHtml(cmd.path || "(no path)")}</span></div>
    `;

    const args = document.createElement("div");
    args.className = "mono";
    args.style.marginTop = "6px";
    args.textContent = JSON.stringify(cmd, null, 2);

    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "8px";

    const btnExec = document.createElement("button");
    btnExec.textContent = "Execute";
    btnExec.onclick = async () => {
      setStatus("Executing…");
      try {
        const res = await window.operator.execute(cmd);
        lastResultText = res?.resultText || "";
        resultEl.value = lastResultText;
        setStatus(res?.result?.ok ? "Done." : "Failed (see result).");
      } catch (e) {
        setStatus("Execution error.");
        resultEl.value = String(e);
      }
    };

    const btnDrop = document.createElement("button");
    btnDrop.textContent = "Dismiss";
    btnDrop.onclick = () => {
      commands = commands.filter((c) => c !== cmd);
      renderInbox();
    };

    row.appendChild(btnExec);
    row.appendChild(btnDrop);
    div.appendChild(header);
    div.appendChild(args);
    div.appendChild(row);
    inboxEl.appendChild(div);
  }
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

btnWorkspace.onclick = async () => {
  setStatus("Choosing workspace…");
  const res = await window.operator.chooseWorkspace();
  await refreshWorkspacePill();
  setStatus(res?.ok ? "Workspace set." : "Workspace not changed.");
};

const btnScanClipboard = $("btnScanClipboard");

btnScanClipboard.onclick = async () => {
  setWarnings([]);
  setStatus("Reading clipboard…");

  try {
    const clip = await window.operator.readClipboard();
    const text = clip?.text || "";
    setStatus(`Scanning clipboard… (${text.length.toLocaleString()} chars)`);
    const scan = await window.operator.scan(text);
    commands = scan?.commands || [];
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
  setStatus("Extracting…");

  try {
    const extracted = await window.operator.extract();
    const text = extracted?.text || "";
    setStatus(`Scanning§ (${text.length.toLocaleString()} chars)`);
    const scan = await window.operator.scan(text);
    commands = scan?.commands || [];
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
  inboxEl.innerHTML = "";
  resultEl.value = "";
  setWarnings([]);
  setStatus("");
  copyStatusEl.textContent = "";
  renderInbox();
};

btnCopyBootstrap.onclick = async () => {
  setStatus("Loading bootstrap prompt…");
  try {
    const res = await window.operator.getBootstrapPrompt();
    const text = res?.text || "";
    if (!text.trim()) {
      setStatus("Bootstrap prompt is empty (missing file?).");
      return;
    }
    await window.operator.copyToClipboard(text);
    setStatus("Bootstrap prompt copied. Paste it into the new chat.");
    copyStatusEl.textContent = "Copied bootstrap prompt.";
    setTimeout(() => (copyStatusEl.textContent = ""), 1200);
  } catch (e) {
    setStatus("Failed to copy bootstrap prompt.");
    setWarnings([String(e)]);
  }
};

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
  const decoded = decodeDetailsB64FromResultText(lastResultText);
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
  renderInbox();
})();
