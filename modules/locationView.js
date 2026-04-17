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

let activePlaceName = null;
let activeSubPlaceId = null;

export function renderLocation() {
  const content = document.getElementById("contentArea");

  const locationData = uiState?.data?.locationData || [];
  const locationPlacesFind = uiState?.data?.locationPlacesFind || [];

  const dynamicPlaces = locationData.filter(
    (p) => p.visible && p.inside_place?.length > 0,
  );

  const isPlacesAvailable = dynamicPlaces.length > 0;
  const placesToShow = isPlacesAvailable ? dynamicPlaces : STATIC_PLACES;

  function buildUI() {
    const listItems = placesToShow
      .map((place) => {
        const title = place.title || place.name;
        const isActive = place.name === activePlaceName;

        const subList =
          isActive && locationPlacesFind.length > 0
            ? `
            <div class="location-sub-list">
              ${locationPlacesFind
                .map((item, i) => {
                  const isSubActive = item.place_id === activeSubPlaceId;
                  return `
                    <div class="location-sub-item ${
                      i < locationPlacesFind.length - 1 ? "with-border" : ""
                    }">
                  <div>
                  <span class="location-sub-dot"></span>
                  <span style="${isSubActive ? "color: #e74c3c; font-weight: bold;" : ""}">${item.name}</span>
                  </div>
                  <div>
                    <button 
                    class="location-direction-btn"
                    data-placeid="${item.place_id}"
                    >
                     GET DIRECTIONS
                    </button>
                  </div>
                </div>`;
                })
                .join("")}
            </div>
          `
            : "";

        return `
          <div class="location-place-wrapper">
            <div
              class="location-place-item ${isActive ? "active" : ""}"
              data-name="${place.name}"
            >
              <span>${title}</span>

              ${
                place.icon
                  ? `
                  <img 
                    src="${place.icon}" 
                    class="location-place-icon"
                    style="background:${place.icon_bg_color || "#333"}"
                  />
                `
                  : ""
              }
            </div>

            ${subList}
          </div>
        `;
      })
      .join("");

    content.innerHTML = `
      <div class="section-card">
        ${listItems || `<div class="location-empty">No places available</div>`}
      </div>
    `;

    // Get Directions places showing
    content.querySelectorAll(".location-direction-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const place_id = btn.dataset.placeid;
        activeSubPlaceId = place_id;
        buildUI();

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "location_place_direction",
          payload: { place_id },
        });
      });
    });

    // Location Title showing
    content.querySelectorAll(".location-place-item").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.name;
        locationPlacesFind.length = 0;
        if (activePlaceName === name) {
          activePlaceName = null;
          buildUI();
          return;
        }

        activePlaceName = name;
        buildUI();

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

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "location_place_click",
          payload: { service },
        });
      });
    });
  }

  buildUI();
}
