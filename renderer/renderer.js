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
const copyStatusEl = $("copyStatus");

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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    setStatus(`Scanning… (${text.length.toLocaleString()} chars)`);

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

btnCopyResult.onclick = async () => {
  if (!lastResultText) {
    copyStatusEl.textContent = "No result to copy.";
    return;
  }
  await window.operator.copyToClipboard(lastResultText);
  copyStatusEl.textContent = "Copied.";
  setTimeout(() => (copyStatusEl.textContent = ""), 1200);
};

// boot
(async () => {
  await refreshWorkspacePill();
  renderInbox();
})();
