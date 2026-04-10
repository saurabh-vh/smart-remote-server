export function controlRecenterBtn({ visible = true, isClose = false } = {}) {
  const parent = document.querySelector(".recenter-view-parent");
  const btn = document.getElementById("recenterBtn");

  if (!parent || !btn) return;

  // 1️ Visibility
  parent.style.display = visible ? "flex" : "none";

  if (!visible) return;

  // 2️ Text mode
  btn.style.display = "flex";

  if (isClose) {
    btn.style.display = "flex";
    btn.textContent = "CLOSE";
    btn.classList.add("close-mode");
  } else {
    btn.textContent = "RECENTER VIEW";
    btn.classList.remove("close-mode");
  }
}
