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

// Reusable Loader
export function showLoader(container, message = "Loading...") {
  container.innerHTML = `
    <style>
      @keyframes dotBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-8px); opacity: 1; }
      }
    </style>
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:10vh;">
      <div style="display:flex;gap:6px;align-items:center;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;animation:dotBounce 1.2s infinite ease-in-out;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;animation:dotBounce 1.2s infinite ease-in-out 0.2s;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;animation:dotBounce 1.2s infinite ease-in-out 0.4s;"></span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);font-weight:500;letter-spacing:0.5px;">${message}</div>
    </div>
  `;
}
