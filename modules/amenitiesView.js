import { socket } from "./socket.js";
import { remoteState } from "./state.js";

const AMENITY_GRADIENTS = [
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
  "linear-gradient(135deg, #fd7043, #ff8a65)",
  "linear-gradient(135deg, #26c6da, #00acc1)",
  "linear-gradient(135deg, #66bb6a, #43a047)",
];
export function renderAmenities({ remoteUiState, getActive }) {
  const content = document.getElementById("contentArea");
  content.innerHTML = `
    <div class="section-title">Amenities</div>
    <div class="amenities-grid" id="amenitiesView"></div>
  `;
  const container = document.getElementById("amenitiesView");
  const list = remoteUiState?.amenities || [];
  const activeAmenityId = getActive("amenity");

  if (!list.length) {
    container.innerHTML = `<div class="empty">No amenities found</div>`;
    return;
  }

  list.forEach((a, index) => {
    const card = document.createElement("div");
    card.className = "amenity-card";
    if (a.id === activeAmenityId) card.classList.add("active");

    const gradient = AMENITY_GRADIENTS[index % AMENITY_GRADIENTS.length];

    card.innerHTML = `
      <div class="amenity-image" style="background: ${gradient};"></div>
      <div class="amenity-overlay"></div>
      <div class="amenity-name">${a.amenity_name || ""}</div>
    `;

    card.onclick = () => {
      document
        .querySelectorAll(".amenity-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "amenity_select",
        payload: { id: a.id },
      });
    };

    container.appendChild(card);
  });
}
