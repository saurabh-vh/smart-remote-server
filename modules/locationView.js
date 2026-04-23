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

// const locationState = uiState.ui.location;
const loc = uiState.ui.location;

export function renderLocation() {
  const content = document.getElementById("contentArea");

  const locationData = uiState?.data?.locationData || [];
  const locationPlacesFind = uiState?.data?.locationPlacesFind || [];
  const futureDevelopments = uiState?.data?.futureDevelopments || [];
  console.log(futureDevelopments);

  const dynamicPlaces = locationData.filter(
    (p) => p.visible && p.inside_place?.length > 0,
  );

  const isPlacesAvailable = dynamicPlaces.length > 0;
  const placesToShow = isPlacesAvailable ? dynamicPlaces : STATIC_PLACES;

  function buildUI() {
    const futureOptions = futureDevelopments.map(
      (item) => `<option value="${item.name}">
          ${item.name || item.title}
        </option>`,
    );

    const listItems = placesToShow
      .map((place) => {
        const title = place.title || place.name;
        const isActive = place.name === loc.activePlaceName;

        const subList =
          isActive && locationPlacesFind.length > 0
            ? `
            <div class="location-sub-list">
              ${locationPlacesFind
                .map((item, i) => {
                  const isSubActive = item.place_id === loc.activeSubPlaceId;
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
          <div class="input-wrapper">
            <div class="location-search-input">
              <input
                type="text"
                class="location-search"
                placeholder="Search Places"
              />
              <div class="autocomplete-dropdown" id="autocompleteDropdown" style="display:none;"></div>
            </div>
            ${
              futureOptions.length > 0
                ? `<div class='future-developments'>
              <span>Future Delopments</span>
              <input
                type="checkbox"
                class="location-search"
                id="futureCheck"
              />
              <div class="future-dropdown" id="futureDropdown">
                <select id="futureSelect">
                  ${futureOptions}
                </select>
              </div>
            </div>`
                : ""
            }
          </div>
          ${listItems || `<div class="location-empty">No places available</div>`}
        </div>
`;

    // =========================
    // FUTURE DEVELOPMENT CHECKBOX CLICK
    // =========================
    if (futureOptions.length > 0) {
      const futureCheck = document.getElementById("futureCheck");
      const futureDropdown = document.getElementById("futureDropdown");

      futureCheck.addEventListener("click", (e) => {
        const showFutureDevelopment = e.target.checked;
        console.log(showFutureDevelopment);
        futureDropdown.style.display = e.target.checked ? "block" : "none";

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "show_future_development",
          payload: { showFutureDevelopment },
        });
      });
      // =========================
      // FUTURE DROPDOWN SELECT EMIT
      // =========================
      const futureSelect = document.getElementById("futureSelect");
      futureSelect.addEventListener("change", (e) => {
        const name = e.target.value;
        if (!name) return;
        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "future_dropdown_select",
          payload: { name },
        });
      });
    }

    // =========================
    // SEARCH INPUT SOCKET EMIT
    // =========================
    const searchInput = content.querySelector(".location-search");

    if (searchInput) {
      let typingTimer;
      let lastValue = "";

      searchInput.addEventListener("input", () => {
        clearTimeout(typingTimer);

        typingTimer = setTimeout(() => {
          const value = searchInput.value.trim();
          if (!value) return;
          if (value.length < 3) return;
          if (value === lastValue) return;
          lastValue = value;

          socket.emit("remote_command", {
            code: remoteState.pairedCode,
            command: "location_search_place",
            payload: { value },
          });
        }, 800);
      });

      searchInput.addEventListener("blur", () => {
        clearTimeout(typingTimer);
        const value = searchInput.value.trim();
        if (!value || value.length < 3 || value === lastValue) return;
        lastValue = value;

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "location_search_place",
          payload: { value },
        });
      });
    }

    // =========================
    // GET DIRECTIONS
    // =========================
    content.querySelectorAll(".location-direction-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const place_id = btn.dataset.placeid;
        loc.activeSubPlaceId = place_id;
        buildUI();

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "location_place_direction",
          payload: { place_id },
        });
      });
    });

    // =========================
    // LOCATION CLICK
    // =========================
    content.querySelectorAll(".location-place-item").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.name;
        locationPlacesFind.length = 0;

        loc.dropdownDismissed = true;
        uiState.data.autocompletePredictions = [];
        setTimeout(() => {
          loc.dropdownDismissed = false;
        }, 1000);

        if (loc.activePlaceName === name) {
          loc.activePlaceName = null;
          loc.activeSubPlaceId = null;
          buildUI();
          return;
        }

        loc.activePlaceName = name;
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

export function updateAutocompleteDropdown() {
  const dropdown = document.querySelector("#autocompleteDropdown");
  if (!dropdown) return;

  if (loc.dropdownDismissed) {
    dropdown.style.display = "none";
    return;
  }

  const predictions = uiState?.data?.autocompletePredictions || [];

  if (predictions.length === 0) {
    dropdown.style.display = "none";
    return;
  }

  const handleOutsideClick = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.style.display = "none";
      document.removeEventListener("click", handleOutsideClick);
    }
  };

  dropdown.style.display = "block";
  dropdown.innerHTML = predictions
    .map(
      (p) => `
      <div class="autocomplete-item" data-placeid="${p.place_id}" data-description="${p.description}">
        <span class="autocomplete-main">${p.main_text || p.description}</span>
        <span class="autocomplete-secondary">${p.secondary_text || ""}</span>
      </div>
    `,
    )
    .join("");

  dropdown.querySelectorAll(".autocomplete-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const place_id = item.dataset.placeid;

      loc.dropdownDismissed = true;
      uiState.data.autocompletePredictions = [];
      dropdown.style.display = "none";
      document.removeEventListener("click", handleOutsideClick);

      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "location_place_direction",
        payload: { place_id },
      });

      setTimeout(() => {
        loc.dropdownDismissed = false;
      }, 1000);
    });
  });

  // setTimeout(() => {
  //   document.addEventListener("click", handleOutsideClick);
  // }, 0);
}
