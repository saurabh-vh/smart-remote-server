import { socket } from "./socket.js";
import { remoteState, uiState } from "./state.js";

const STATIC_PLACES = [
  { title: "Health Care", name: "hospital", place: ["hospital"] },
  { title: "Schools", name: "school", place: ["school"] },
  { title: "Shopping", name: "shopping", place: ["shopping_mall"] },
  { title: "Worship", name: "worship", place: ["hindu_temple"] },
  { title: "Parks", name: "parks", place: ["park"] },
  { title: "Food", name: "food", place: ["restaurant"] },
  { title: "Banks", name: "bank", place: ["bank"] },
  { title: "Train", name: "train", place: ["train_station"] },
  { title: "Fuel", name: "fuel", place: ["gas_station"] },
];

export function renderLocation() {
  const content = document.getElementById("contentArea");

  const locationData = uiState?.data?.locationData || [];
  // console.log("locationData in renderLocation:", locationData);

  const dynamicPlaces = locationData.filter(
    (p) => p.visible && p.inside_place?.length > 0,
  );

  const isPlacesAvailable = dynamicPlaces.length > 0;
  const placesToShow = isPlacesAvailable ? dynamicPlaces : STATIC_PLACES;
  // console.log("placesToShow:", placesToShow);

  // Click handler
  const items = placesToShow
    .map((place) => {
      const title = place.title || place.name;
      return `
      <div 
    class="location-place-item" 
    data-name="${place.name}"
    style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid #eee;
      font-size: 16px;
      cursor: pointer;
    "
  >
    <span>${title}</span>
    ${
      place.icon
        ? `<img src="${place.icon}" width="28" height="28" 
            style="background:${place.icon_bg_color || "#333"};border-radius:6px;padding:3px;object-fit:contain;" />`
        : ""
    }
  </div>
    `;
    })
    .join("");

  content.innerHTML = `
  <div class="section-card">
      ${items || '<div style="padding:16px;opacity:0.5;font-size:13px;">No places available</div>'}
    </div>
`;

  content.querySelectorAll(".location-place-item").forEach((el) => {
    el.addEventListener("click", () => {
      const name = el.dataset.name;

      content.querySelectorAll(".location-place-item").forEach((e) => {
        e.classList.remove("active");
      });
      el.classList.add("active");

      const place = placesToShow.find((p) => p.name === name);
      if (!place) return;

      const service =
        isPlacesAvailable && place.inside_place?.length > 0
          ? {
              place: place.inside_place.map((a) => a.value),
              type: "dynamic",
              zoom_level: place.zoom_level || 14,
            }
          : {
              place: place.place,
              zoom_level: 14,
            };

      // console.log("Emitting location_place_click:", service);

      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "location_place_click",
        payload: { service },
      });
    });
  });
}
