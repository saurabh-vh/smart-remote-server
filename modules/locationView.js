export function renderLocation() {
  const content = document.getElementById("contentArea");
  content.innerHTML = `
    <div class="section-card" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10vh;
      gap: 12px;
      color: #888;
    ">
      <div style="font-size: 32px;">📍</div>
      <div style="font-size: 16px; font-weight: 600; color: #333;">Viewing Location</div>
      <div style="font-size: 13px;">Controls available on screen</div>
    </div>
  `;
}
