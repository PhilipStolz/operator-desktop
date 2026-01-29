const root = document.getElementById("toastRoot");
let activeCount = 0;

function requestSizeUpdate() {
  if (!root || !window.operator?.setToastSize) return;
  const rect = root.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  window.operator.setToastSize({ width, height }).catch(() => {});
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
  requestSizeUpdate();
  setTimeout(() => {
    toast.remove();
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
      window.operator?.hideToast?.().catch(() => {});
    } else {
      requestSizeUpdate();
    }
  }, 2600);
}

if (window.operator?.onToast) {
  window.operator.onToast((payload) => {
    addToast(payload?.message, payload?.kind);
  });
}

window.__showToast = addToast;
