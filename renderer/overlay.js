const overlay = document.getElementById("gettingStartedOverlay");
const btnClose = document.getElementById("gettingStartedClose");
const btnCloseFooter = document.getElementById("gettingStartedCloseFooter");

function openOverlay() {
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

async function closeOverlay() {
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  try {
    await window.operator?.closeGettingStarted?.();
  } catch {}
}

if (btnClose) {
  btnClose.onclick = () => closeOverlay();
}

if (btnCloseFooter) {
  btnCloseFooter.onclick = () => closeOverlay();
}

if (overlay) {
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) closeOverlay();
  });
}

window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeOverlay();
});

if (window.operator?.onOpenGettingStarted) {
  window.operator.onOpenGettingStarted(() => {
    openOverlay();
  });
}

window.__openGettingStarted = openOverlay;
