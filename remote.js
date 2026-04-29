import { renderAmenities } from "./modules/amenitiesView.js";
import { applyJoystickLayout } from "./modules/applyJoystickLayout.js";
import { renderHomes } from "./modules/homesView.js";
import { initJoystick } from "./modules/joystick.js";
import {
  renderLocation,
  updateAutocompleteDropdown,
} from "./modules/locationView.js";
import { lookJoystick } from "./modules/lookJoystick.js";
import {
  ACTION_CONFIG,
  buildEllipsisPopup,
  hideScreenOverlay,
  rightSideNavbar,
} from "./modules/rightSideNavbar.js";
import { initRubberBand } from "./modules/rubberBand.js";
import { socket } from "./modules/socket.js";
import { remoteState, resetSectionState, uiState } from "./modules/state.js";
import { initThemeToggle } from "./modules/themeToggle.js";
import { controlRecenterBtn } from "./modules/uiHelpers.js";

const appEl = document.getElementById("app");

// Minimal flag to track whether right-side icons should be shown.
let showRightIcons = true;

// Fetch env and, if not PROD, hide only the icon elements (keep containers present).
fetch("/env")
  .then((r) => r.json())
  .then(({ ENV_SETUP }) => {
    if (ENV_SETUP !== "LOCAL") {
      showRightIcons = false;
      document
        .querySelectorAll(".sidebar-right i, .mobile-icons i")
        .forEach((el) => {
          el.style.display = "none";
        });
    }
  })
  .catch(() => {});

let projectName = null; // Name of connected project
let remoteUiState = null; // Latest state received from display
let availableDisplays = []; // List of all available displays

/* =========================
     URL AUTO CONNECT
  ========================= */
const params = new URLSearchParams(window.location.search);
const codeFromUrl = params.get("code"); // Read code from URL query param

// Auto-fill inputs and pair if code found in URL
if (codeFromUrl && codeFromUrl.length === 4) {
  document.querySelectorAll(".code-input").forEach((i, idx) => {
    i.value = codeFromUrl[idx] || "";
  });
  socket.emit("pair_remote", { code: codeFromUrl });
}

/* =========================
     CODE INPUTS
  ========================= */
const inputs = document.querySelectorAll(".code-input");

inputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "");
    if (input.value && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
    checkAndPair();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      inputs[index - 1].focus();
    }
  });
});

// Emit pair request when all 4 digits are entered
function checkAndPair() {
  const code = Array.from(inputs)
    .map((i) => i.value)
    .join("");
  if (code.length === 4) socket.emit("pair_remote", { code });
}

/* =========================
     MODE SYSTEM
  ========================= */
let currentMode = "map"; // Current control mode: "map" | "walk"
function getCurrentMode() {
  return currentMode;
}
// Switch joystick UI based on mode
function setMode(mode) {
  currentMode = mode;

  // Location tab hide
  if (uiState.section === "location") {
    document.getElementById("zoomControl").style.display = "none";
    document.querySelector(".look-joystick").style.display = "none";
    document.querySelectorAll(".fa-person-swimming").forEach((el) => {
      el.style.display = "none";
    });
    controlRecenterBtn({ visible: false });
    return;
  }

  // Amenities section hide recenter Button or Hotspot Icon
  if (uiState.section === "amenities") {
    document.querySelectorAll(".fa-person-swimming").forEach((el) => {
      el.style.display = "none";
    });
    controlRecenterBtn({ visible: false });
  } else {
    controlRecenterBtn();
  }
  // Joystick panel hamesha show (homes + amenities)
  document.querySelector(".joystick-panel").style.display = "flex";

  if (mode === "map") {
    // Map mode: show rubber band zoom, hide camera pan joystick
    document.getElementById("rubberBand").style.display = "flex";
    document.getElementById("zoomControl").style.display = "none";
    document.querySelector(".look-joystick").style.display = "none";
    if (uiState.section !== "amenities") {
      controlRecenterBtn();
    }
  } else {
    // Walk mode: show camera pan joystick, hide rubber band
    document.getElementById("rubberBand").style.display = "none";
    document.querySelector(".look-joystick").style.display = "block";
    controlRecenterBtn({ visible: false });
  }
}

/* =========================
     NAVIGATION HELPERS
  ========================= */
// Push new level to stack and re-render
function navigate(level, id, extra = {}) {
  uiState.stack.push({ level, id, ...extra });
  if (level === "building") {
    uiState.searchQuery = "";
    uiState.typeFilter = "";
    uiState.data.homes.units = [];
  }
  render();
}

// Go one level back in navigation stack
function goBack() {
  const current = uiState.stack[uiState.stack.length - 1];
  if (current?.level === "building") {
    // Replace "building" with "selectedBuilding" to keep highlight
    uiState.stack.pop();
    // uiState.stack.push({ level: "selectedBuilding", id: current.id });
  } else {
    uiState.stack.pop();
  }

  uiState.data.takeMeTo = [];
  uiState.searchQuery = "";
  uiState.typeFilter = "";

  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "home_search_back",
  });

  // Switch to map mode when back on buildings list
  const top = uiState.stack[uiState.stack.length - 1];

  if (current?.level === "unit") {
    setMode("map");
    render();
    return;
  }

  if (!top || top.level === "selectedBuilding") {
    setMode("map");
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "request_homes",
    });
  }

  // Unit level se wapas — walk mode rehga
  if (top?.level === "building") {
    setMode("walk");
  }

  render();
}

// Reset section to root and clear stack
function resetSection(section) {
  if (uiState.section === section) {
    render();
  }
  resetSectionState(uiState.section);
  uiState.section = section;
  uiState.stack = [];
  uiState.searchQuery = "";
  uiState.typeFilter = "";
  setMode("map"); // Always start in map mode on section change
  render();
}

/* =========================
     MENU CLICK
  ========================= */
document.querySelectorAll(".menu-item").forEach((item) => {
  item.onclick = () => {
    document
      .querySelectorAll(".menu-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    resetSection(item.dataset.section);
    // Request fresh data from display on tab change
    if (uiState.section === "homes" || uiState.section === "amenities") {
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "request_homes",
      });
    }
    if (uiState.section === "location") {
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "request_location",
      });
    }
  };
});

// RightSideNavbar More options popup overlay
document.getElementById("screenBlurClose").addEventListener("click", () => {
  hideScreenOverlay();
  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "closeModal",
    payload: {},
  });
});

// Recenter View Button OR Close
recenterBtn.addEventListener("click", () => {
  if (recenterBtn.classList.contains("close-mode")) {
    controlRecenterBtn({ visible: false });
    // Active image deselect
    document
      .querySelectorAll(".img-box")
      .forEach((b) => b.classList.remove("active"));

    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "closeModal",
      payload: {},
    });
    return;
  }
  const activeBuildingId =
    getActive("building") || getActive("selectedBuilding");
  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "recenter_view",
    payload: { id: activeBuildingId },
  });
});

// Disconnect remote (used by close button and visibility/unload handlers)
function unpairRemoteClient() {
  if (!remoteState.pairedCode) return;

  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "remote_disconnected",
    payload: {},
  });

  // Also tell server to unpair this remote (without removing displays/projects)
  socket.emit("unpair_remote", { code: remoteState.pairedCode });

  // Remote UI reset
  const statusEl = document.getElementById("projectStatus");
  if (statusEl && statusEl.firstChild)
    statusEl.firstChild.textContent = "Not connected";
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) closeBtn.style.display = "none";
  const displaySelect = document.getElementById("displaySelect");
  if (displaySelect) displaySelect.innerHTML = "";

  remoteState.pairedCode = null;
  projectName = null;
  availableDisplays = [];
  appEl.classList.remove("connected");
}

document
  .getElementById("closeBtn")
  .addEventListener("click", unpairRemoteClient);

// Tab hide → disconnect | Tab visible → auto reconnect via URL code
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    unpairRemoteClient();
  } else {
    const savedCode = new URLSearchParams(window.location.search).get("code");
    socket.emit("pair_remote", { code: savedCode });
  }
});

// Also attempt unpair on page hide / unload to cover more cases
window.addEventListener("pagehide", () => unpairRemoteClient());
window.addEventListener("beforeunload", () => unpairRemoteClient());

/* =========================
     SOCKET EVENTS
  ========================= */
// Pairing successful — store code and update UI
socket.on(
  "pair_success",
  ({ code, projectName: projName, displays, moreOptions }) => {
    remoteState.pairedCode = code;
    projectName = projName;
    availableDisplays = displays;
    uiState.data.moreOptions = moreOptions || {};

    rightSideNavbar(sidebarRight);

    // Mobile clone
    mobileContainer.innerHTML = "";
    sidebarRight.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        mobileContainer.appendChild(node.cloneNode(true));
      }
    });

    document
      .querySelectorAll(".ellipsis-popup")
      .forEach((p) => buildEllipsisPopup(p));

    const statusEl = document.getElementById("projectStatus");
    statusEl.firstChild.textContent = "Connected to " + projName;

    const closeBtn = document.getElementById("closeBtn");
    closeBtn.style.display = "flex";

    appEl.classList.add("connected");
    updateDisplaySelector(displays, code);
  },
);

// Display sent its current state — update local data and re-render
socket.on("display_state", ({ state }) => {
  remoteUiState = state;
  if (state?.firstLevelFilter?.selectedBuildings?.length) {
    uiState.data.homes.buildings = state.firstLevelFilter.selectedBuildings;
  }
  if (state?.amenities?.length) {
    uiState.data.amenities = state.amenities;
  }
  uiState.data.takeMeTo = state?.takeMeTo || [];
  uiState.data.locationData = state?.locationData || [];
  uiState.data.locationPlacesFind = state?.locationPlacesFind || [];
  uiState.data.autocompletePredictions = state?.autocompletePredictions || [];
  uiState.data.joystickPosition = state?.joystickPosition;
  uiState.data.futureDevelopments = state?.futureDevelopments;
  uiState.data.apartmentScreen = state?.apartmentScreen;
  // console.log("display_state", state);

  applyJoystickLayout(uiState.data.joystickPosition);
  render();
  updateAutocompleteDropdown();
});

// Units list updated from display
socket.on("second_level_update", ({ selectedUnits = [] }) => {
  uiState.data.homes.units = selectedUnits;
  render();
});

// Available displays list changed
socket.on("display_list_update", ({ displays }) => {
  availableDisplays = displays;
  updateDisplaySelector(displays, remoteState.pairedCode);
});

// Pairing failed — reset inputs
socket.on("pair_error", ({ message }) => {
  alert(message);
  inputs.forEach((i) => (i.value = ""));
  appEl.classList.remove("connected");
});

/* =========================
     DISPLAY SELECTOR
  ========================= */
// Populate dropdown with available displays
function updateDisplaySelector(displays, currentCode) {
  const select = document.getElementById("displaySelect");
  select.innerHTML = "";
  displays.forEach((display) => {
    const opt = document.createElement("option");
    opt.value = display.code;
    opt.textContent = display.displayName;
    if (display.code === currentCode) opt.selected = true;
    select.appendChild(opt);
  });
}

// Switch to a different display screen
document.getElementById("displaySelect").addEventListener("change", (e) => {
  const newCode = e.target.value;
  if (!newCode || newCode === remoteState.pairedCode) return;
  socket.emit("switch_display", { newCode, projectName });
});

// Display switch confirmed by server
socket.on("switch_success", ({ code, displayName, displays }) => {
  remoteState.pairedCode = code;
  availableDisplays = displays;
  document.getElementById("projectStatus").textContent =
    "Connected to " + projectName + " - " + displayName;
  updateDisplaySelector(displays, code);
});

/* =========================
     RENDER CONTROLLER
  ========================= */
// Main render — decides which section to show
function render() {
  const content = document.getElementById("contentArea");
  content.innerHTML = "";
  if (uiState.section === "homes")
    renderHomes({ goBack, getActive, getUnitTypeLabel, setMode, navigate });
  if (uiState.section === "amenities") renderAmenities({ getActive });
  if (uiState.section === "location") renderLocation();
}

// Get the active item id for a given navigation level
function getActive(level) {
  return uiState.stack.findLast((item) => item.level === level)?.id || null;
}

// Extract base unit type label before "-"
function getUnitTypeLabel(unitType) {
  return (unitType || "").split("-")[0].trim();
}

// Clone sidebar icons into mobile container (single source of truth)
const sidebarRight = document.querySelector(".sidebar-right");
const mobileContainer = document.querySelector(".mobile-icons");

sidebarRight.childNodes.forEach((node) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    mobileContainer.appendChild(node.cloneNode(true));
  }
});

// If env check already decided to hide icons, ensure clones are hidden too.
if (!showRightIcons) {
  document
    .querySelectorAll(".sidebar-right i, .mobile-icons i")
    .forEach((el) => {
      el.style.display = "none";
    });
}

// Icons that toggle between two states
const TOGGLE_ICONS = new Set(["eye", "volume", "maximize", "ellipsis"]);
// Swap icon class between iconA and iconB, return new state
function toggleIcon(el) {
  const { iconA, iconB } = el.dataset;
  const iconEl = el.tagName === "I" ? el : el.querySelector("i");
  const isA = iconEl.classList.contains(iconA);
  iconEl.classList.replace(isA ? iconA : iconB, isA ? iconB : iconA);
  return !isA;
}

// Single delegated listener — handles all [data-action] clicks globally
document.addEventListener("click", ({ target }) => {
  const el = target.closest("[data-action]");

  // Close all popups if clicked outside any ellipsis-wrapper
  if (!target.closest(".ellipsis-wrapper")) {
    document
      .querySelectorAll(".ellipsis-popup")
      .forEach((p) => p.classList.remove("open"));
    const cardVisible = document
      .getElementById("screenBlurCard")
      .classList.contains("visible");
    if (!cardVisible) {
      document.getElementById("screenBlurOverlay").classList.remove("active");
    }
  }

  if (!el) return;

  const { action } = el.dataset;

  // Ellipsis toggle — find popup inside THIS wrapper only
  if (action === "ellipsis") {
    const popup = el
      .closest(".sidebar-right, .mobile-icons")
      ?.querySelector(".ellipsis-popup");

    if (!popup) return;

    popup.classList.toggle("open");

    if (popup.classList.contains("open")) {
      document.getElementById("screenBlurOverlay").classList.add("active");
    } else {
      document.getElementById("screenBlurOverlay").classList.remove("active");
    }
  }

  const state = TOGGLE_ICONS.has(action) ? toggleIcon(el) : null;
  if (el.tagName === "I") {
    el.classList.toggle("active");
  }
  const config = ACTION_CONFIG[action];
  if (!config) return;

  // console.log(`[${action}]`, state !== null ? `→ ${state}` : "clicked");

  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: config.command,
    payload: config.payload(state),
  });
  //To Show Red Button to close popup in website
  if (config.onTrigger) config.onTrigger();
});

// ================================================
// INIT
// ================================================
initJoystick({ getCurrentMode });
initRubberBand();
lookJoystick();
initThemeToggle();
setMode("map");
render();
