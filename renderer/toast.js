const root = document.getElementById("toastRoot");

function addToast(message, kind) {
  if (!root) return;
  const text = String(message || "").trim();
  if (!text) return;
  const toast = document.createElement("div");
  toast.className = kind === "error" ? "toast error" : "toast";
  toast.textContent = text;
  root.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
}

if (window.operator?.onToast) {
  window.operator.onToast((payload) => {
    addToast(payload?.message, payload?.kind);
  });
}

window.__showToast = addToast;
