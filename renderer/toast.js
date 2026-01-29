const root = document.getElementById("toastRoot");
let activeCount = 0;
let sizeUpdatePending = false;

function applyAppearanceVars(payload) {
  const vars = payload?.vars;
  if (!vars) return;
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, String(value));
  }
}

function requestSizeUpdate() {
  if (!root || !window.operator?.setToastSize) return;
  const rect = root.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, root.scrollWidth || 0)) + 4;
  const height = Math.ceil(Math.max(rect.height, root.scrollHeight || 0)) + 16;
  window.operator.setToastSize({ width, height }).catch(() => {});
}

function scheduleSizeUpdate() {
  if (sizeUpdatePending) return;
  sizeUpdatePending = true;
  requestAnimationFrame(() => {
    sizeUpdatePending = false;
    requestSizeUpdate();
  });
}

function addToast(message, kind) {
  if (!root) return;
  const text = String(message || "").trim();
  if (!text) return;
  const toast = document.createElement("div");
  toast.className = kind === "error" ? "toast error" : "toast";
  toast.textContent = text;
  root.appendChild(toast);
  activeCount += 1;
  scheduleSizeUpdate();
  setTimeout(() => {
    toast.remove();
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
      window.operator?.hideToast?.().catch(() => {});
    } else {
      scheduleSizeUpdate();
    }
  }, 2600);
}

if (window.operator?.onToast) {
  window.operator.onToast((payload) => {
    addToast(payload?.message, payload?.kind);
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

window.__showToast = addToast;
