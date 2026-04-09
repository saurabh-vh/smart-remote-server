import {
  ACTION_CONFIG,
  buildEllipsisPopup,
  hideScreenOverlay,
  rightSideNavbar,
} from "./modules/rightSideNavbar.js";
import { socket } from "./modules/socket.js";
import { remoteState, uiState } from "./modules/state.js";
import { resetRecenterBtn } from "./modules/uiHelpers.js";
import { renderUnitsWithFilters } from "./modules/unitsView.js";

// const socket = io();
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

// Switch joystick UI based on mode
function setMode(mode) {
  currentMode = mode;

  // Location tab pe sab hide
  if (uiState.section === "location") {
    document.querySelector(".joystick-panel").style.display = "none";
    document.getElementById("rubberBand").style.display = "none";
    document.getElementById("zoomControl").style.display = "none";
    document.querySelector(".look-joystick").style.display = "none";
    document.querySelector(".recenter-view-parent").style.display = "none";
    return;
  }

  // Amenities section hide recenter Button
  if (uiState.section === "amenities") {
    document.querySelector(".recenter-view-parent").style.display = "none";
  } else {
    document.querySelector(".recenter-view-parent").style.display = "flex";
  }

  // Joystick panel hamesha show (homes + amenities)
  document.querySelector(".joystick-panel").style.display = "flex";

  if (mode === "map") {
    // Map mode: show rubber band zoom, hide camera pan joystick
    document.getElementById("rubberBand").style.display = "flex";
    document.getElementById("zoomControl").style.display = "none";
    document.querySelector(".look-joystick").style.display = "none";
    if (uiState.section !== "amenities") {
      document.querySelector(".recenter-view-parent").style.display = "flex";
    }
  } else {
    // Walk mode: show camera pan joystick, hide rubber band
    document.getElementById("rubberBand").style.display = "none";
    document.querySelector(".look-joystick").style.display = "block";
    document.querySelector(".recenter-view-parent").style.display = "none";
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
    // Add recenter button
    resetRecenterBtn();
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
    recenterBtn.style.display = "none";
    recenterBtn.textContent = "RECENTER VIEW";
    recenterBtn.classList.remove("close-mode");

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

// Unpair when the page becomes hidden (minimized or backgrounded) — useful for mobile
document.addEventListener("visibilitychange", () => {
  if (document.hidden) unpairRemoteClient();
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
  uiState.data.homes.buildings =
    state?.firstLevelFilter?.selectedBuildings || [];

  uiState.data.takeMeTo = state?.takeMeTo || [];
  // console.log("uiState.data.takeMeTo", uiState.data.takeMeTo);
  render();
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
  if (uiState.section === "homes") renderHomes();
  if (uiState.section === "amenities") renderAmenities();
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
  const isA = el.classList.contains(iconA);
  el.classList.replace(isA ? iconA : iconB, isA ? iconB : iconA);
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
    const thisPopup = el
      .closest(".ellipsis-wrapper")
      .querySelector(".ellipsis-popup");

    document.querySelectorAll(".ellipsis-popup").forEach((p) => {
      if (p !== thisPopup) p.classList.remove("open");
    });

    const allItems = Array.from(
      document.querySelectorAll(
        ".sidebar-right > i, .sidebar-right .ellipsis-wrapper",
      ),
    );
    const index = allItems.indexOf(el.closest(".ellipsis-wrapper")) + 1;

    thisPopup.classList.remove("pop-left", "pop-right");
    if (index % 3 === 0) {
      thisPopup.classList.add("pop-right");
    } else {
      thisPopup.classList.add("pop-left");
    }

    thisPopup.classList.toggle("open");

    // Popup open hone par sirf blur overlay, card nahi
    if (thisPopup.classList.contains("open")) {
      document.getElementById("screenBlurOverlay").classList.add("active");
    } else {
      document.getElementById("screenBlurOverlay").classList.remove("active");
    }
  }

  const state = TOGGLE_ICONS.has(action) ? toggleIcon(el) : null;
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

/* =========================
     HOMES
  ========================= */
// Decide whether to show buildings list or units list or takeMeTo
function renderHomes() {
  const content = document.getElementById("contentArea");

  const hasWings = uiState.data.homes.buildings.some(
    (b) => b.wings && b.wings.length > 0,
  );

  content.innerHTML = `<div class="section-card ${hasWings ? "section-card-wings" : ""}" id="homesView"></div>`;

  const view = document.getElementById("homesView");
  const current = uiState.stack[uiState.stack.length - 1];
  if (!current || current.level === "selectedBuilding") {
    renderBuildings(view);
  } else if (current.level === "building") {
    renderUnitsWithFilters(view, {
      socket,
      pairedCode: remoteState.pairedCode,
      goBack,
      getActive,
      getUnitTypeLabel,
      setMode,
      navigate,
    });
  } else if (current.level === "unit") {
    renderTakeMeTo(view);
  }
}

// Render clickable buildings list
function renderBuildings(container) {
  const buildings = uiState.data.homes.buildings;
  const activeBuildingId = getActive("building");

  if (!buildings.length) {
    container.innerHTML = `
    <style>
      @keyframes dotBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-8px); opacity: 1; }
      }
    </style>
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:10vh;">
      <div style="display:flex; gap:6px; align-items:center;">
        <span style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out;"></span>
        <span style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.2s;"></span>
        <span style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.4s;"></span>
      </div>
            <div style="font-size:13px; color:#aaa; font-weight:500; letter-spacing:0.5px;">Loading buildings...</div>

    </div>
  `;
    return;
  }
  buildings.forEach((b) => {
    // If building has wings, render a non-clickable building header
    // and individual clickable wing rows beneath it.
    if (b.wings && b.wings.length > 0) {
      const wrapper = document.createElement("div");
      wrapper.className = "building-with-wings";

      const title = document.createElement("div");
      title.className = "list-row building-title";
      title.textContent = b.building_name || `Building ${b.id}`;
      // title.textContent =  ` b.building_name Building ${b.id}`;
      wrapper.appendChild(title);

      const wingsWrap = document.createElement("div");
      wingsWrap.className = "wings-wrap";

      b.wings.forEach((w) => {
        const wingRow = document.createElement("div");
        wingRow.className = "list-row wing-row";
        wingRow.textContent = w.wing_name || `Wing ${w.id}`;
        // wingRow.textContent = `w.wing_name Wing ${w.id}`;

        wingRow.onclick = () => {
          // Visually mark selected wing
          document
            .querySelectorAll(".wing-row")
            .forEach((r) => r.classList.remove("active"));
          wingRow.classList.add("active");

          // Navigate to building level and include wing info in the stack
          navigate("building", b.id, { wingId: w.id, wingName: w.wing_name });

          // Emit wing-level filter to the display. Include both numeric id and wing_id string if available.
          socket.emit("remote_command", {
            code: remoteState.pairedCode,
            command: "home_search_filter",
            // payload: { id: w.id },
            payload: { id: b.id, wing_id: w.id, wing_uuid: w.wing_id },
          });
        };

        wingsWrap.appendChild(wingRow);
      });

      wrapper.appendChild(wingsWrap);
      container.appendChild(wrapper);
    } else {
      // No wings — keep previous behaviour (clickable building row)
      const row = document.createElement("div");
      row.className = "list-row";
      if (b.id === activeBuildingId) row.classList.add("active");
      row.textContent = b.building_name || `Building ${b.id}`;
      row.onclick = () => {
        navigate("building", b.id);
        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "home_search_filter",
          payload: { id: b.id },
        });
      };
      container.appendChild(row);
    }
  });
}

// Render take me to rooms list
function renderTakeMeTo(container) {
  const rooms = uiState.data.takeMeTo;
  const activeRoom = getActive("room");

  // Toolbar with back button
  const toolbar = document.createElement("div");
  toolbar.className = "list-row units-toolbar";

  const backBtn = document.createElement("div");
  backBtn.className = "units-back";
  backBtn.textContent = "\u2190";
  backBtn.onclick = goBack;
  toolbar.appendChild(backBtn);

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.fontSize = "16px";
  title.style.padding = "0 8px";
  title.textContent = "Take Me To";
  // ← Selected unit number stack se lo
  const activeUnit = uiState.stack.findLast((s) => s.level === "unit");
  const unitNumber = activeUnit?.unitNumber || "Unit";
  title.textContent = unitNumber;
  toolbar.appendChild(title);

  container.appendChild(toolbar);

  if (!rooms.length) {
    const loading = document.createElement("div");
    loading.className = "empty";
    loading.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:10vh;">
      <div style="display:flex; gap:6px; align-items:center;">
        <span class="dot-bounce" style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out;"></span>
        <span class="dot-bounce" style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.2s;"></span>
        <span class="dot-bounce" style="width:8px; height:8px; border-radius:50%; background:#007aff; display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.4s;"></span>
      </div>
            <div style="font-size:13px; color:#aaa; font-weight:500; letter-spacing:0.5px;">Entering the unit...</div>
    </div>
  `;
    container.appendChild(loading);

    // Inject animation if not already present
    if (!document.getElementById("dotBounceStyle")) {
      const style = document.createElement("style");
      style.id = "dotBounceStyle";
      style.textContent = `
      @keyframes dotBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-8px); opacity: 1; }
      }
    `;
      document.head.appendChild(style);
    }

    return;
  }

  // Render each room as a list row
  rooms.forEach((room) => {
    const row = document.createElement("div");
    row.className = "list-row";
    if (room === activeRoom) row.classList.add("active");
    row.textContent = room;

    row.onclick = () => {
      // Highlight active room
      document
        .querySelectorAll("#homesView .list-row")
        .forEach((r) => r.classList.remove("active"));
      row.classList.add("active");

      uiState.activeRoom = room;

      // Tell display to navigate to this room
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "take_me_to",
        payload: { room },
      });
    };

    container.appendChild(row);
  });
}

/* =========================
     AMENITIES
  ========================= */
// Gradient array — Each card Diff color
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
function renderAmenities() {
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
      navigate("amenity", a.id);
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "amenity_select",
        payload: { id: a.id },
      });
    };

    container.appendChild(card);
  });
}

/* =========================
     Location UI
  ========================= */
function renderLocation() {
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

// ================================================
// LEFT JOYSTICK
// ================================================
const joystick = document.querySelector(".joystick");
const stick = document.querySelector(".joystick-inner");

let joystickDragging = false;
let centerX = 0,
  centerY = 0;
let lastSend = 0;

// Calculate WASD direction string from x,y offset
function getDirection(x, y) {
  const threshold = 10;
  let vertical = "",
    horizontal = "";
  if (y < -threshold) vertical = "w";
  if (y > threshold) vertical = "s";
  if (x < -threshold) horizontal = "a";
  if (x > threshold) horizontal = "d";
  return vertical + horizontal;
}

// Store joystick center on drag start
function startJoystick(e) {
  joystickDragging = true;
  const rect = joystick.getBoundingClientRect();
  centerX = rect.width / 2;
  centerY = rect.height / 2;
}

// Emit joystick data — map mode sends x,y, walk mode sends WASD
function sendDirection(limitedX, limitedY) {
  const now = Date.now();
  if (now - lastSend < 50) return;
  lastSend = now;
  // For image gallery joystick
  if (document.querySelector(".image-wrapper")) {
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "image_drag",
      payload: { x: limitedX, y: -limitedY },
    });
    return;
  }
  if (currentMode === "map") {
    const payload = {
      type: "joystick",
      action: "move",
      x: parseFloat((limitedX / 35).toFixed(2)),
      y: parseFloat((-limitedY / 35).toFixed(2)),
    };

    // console.log("Joystick map payload:", payload);

    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "joystick_move",
      payload,
    });
  } else {
    const direction = getDirection(limitedX, limitedY);
    if (!direction) return;

    // console.log("Walk direction:", direction);

    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "move",
      payload: { key: direction },
    });
  }
}

// Calculate drag offset and update stick position
function moveJoystick(clientX, clientY) {
  if (!joystickDragging) return;
  const rect = joystick.getBoundingClientRect();
  const x = clientX - rect.left - centerX;
  const y = clientY - rect.top - centerY;
  const max = 35;
  const limitedX = Math.max(-max, Math.min(max, x));
  const limitedY = Math.max(-max, Math.min(max, y));
  stick.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
  sendDirection(limitedX, limitedY);
}

// Reset stick to center and emit stop
function stopJoystick() {
  if (!joystickDragging) return;
  joystickDragging = false;
  stick.style.transform = "translate(-50%, -50%)";
  if (currentMode === "map") {
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "joystick_move",
      payload: { type: "joystick", action: "stop", x: 0, y: 0 },
    });
  } else {
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "move_stop",
      payload: { key: "stop" },
    });
  }
}

// Touch events — track by touch identifier to support multi-touch
let leftTouchId = null;
joystick.addEventListener("touchstart", (e) => {
  if (leftTouchId !== null) return;
  const touch = e.changedTouches[0];
  leftTouchId = touch.identifier;
  startJoystick(touch);
});
document.addEventListener("touchmove", (e) => {
  if (leftTouchId === null) return;
  for (let touch of e.touches) {
    if (touch.identifier === leftTouchId) {
      moveJoystick(touch.clientX, touch.clientY);
      break;
    }
  }
});
document.addEventListener("touchend", (e) => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === leftTouchId) {
      leftTouchId = null;
      stopJoystick();
    }
  }
});

// Mouse events for desktop testing
joystick.addEventListener("mousedown", startJoystick);
document.addEventListener("mouseup", stopJoystick);
document.addEventListener("mousemove", (e) =>
  moveJoystick(e.clientX, e.clientY),
);

// ================================================
// RUBBER BAND ZOOM (map mode)
// ================================================
const rubberBand = document.getElementById("rubberBand");
const rubberInner = document.getElementById("rubberInner");

let rubberDragging = false;
let rubberTouchId = null;
let rubberStartY = 0;
let rubberOffsetY = 0;
let rubberLastSend = 0;
const RUBBER_MAX = 80;

// Move rubber inner and emit zoom strength
function updateRubber(clientY) {
  rubberOffsetY = clientY - rubberStartY;
  rubberOffsetY = Math.max(-RUBBER_MAX, Math.min(RUBBER_MAX, rubberOffsetY));
  rubberInner.style.transform = `translate(-50%, calc(-50% + ${rubberOffsetY}px))`;

  const now = Date.now();
  if (now - rubberLastSend < 50) return;
  rubberLastSend = now;

  const strength = parseFloat(
    (Math.abs(rubberOffsetY) / RUBBER_MAX).toFixed(2),
  );
  if (strength < 0.05) return;

  // console.log(`[Zoom] direction: ${rubberOffsetY < 0 ? "in" : "out"}, strength: ${strength}`,);

  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "zoom",
    payload: {
      type: "zoom",
      action: "start",
      direction: rubberOffsetY < 0 ? 1 : -1,
      strength,
    },
  });
}

// Snap inner back to center and emit stop
function resetRubber() {
  rubberDragging = false;
  rubberTouchId = null;
  rubberOffsetY = 0;
  rubberInner.style.transform = "translate(-50%, -50%)";
  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "zoom",
    payload: { type: "zoom", action: "stop", direction: 0, strength: 0 },
  });
}

rubberBand.addEventListener("touchstart", (e) => {
  if (rubberTouchId !== null) return;
  const touch = e.changedTouches[0];
  rubberTouchId = touch.identifier;
  rubberDragging = true;
  rubberStartY = touch.clientY;
});
document.addEventListener("touchmove", (e) => {
  if (!rubberDragging || rubberTouchId === null) return;
  for (let touch of e.touches) {
    if (touch.identifier === rubberTouchId) {
      updateRubber(touch.clientY);
      break;
    }
  }
});
document.addEventListener("touchend", (e) => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === rubberTouchId) resetRubber();
  }
});
rubberBand.addEventListener("pointerdown", (e) => {
  rubberDragging = true;
  rubberStartY = e.clientY;
});
window.addEventListener("pointermove", (e) => {
  if (!rubberDragging) return;
  updateRubber(e.clientY);
});
window.addEventListener("pointerup", () => {
  if (!rubberDragging) return;
  resetRubber();
});

// ================================================
// RIGHT JOYSTICK — camera pan (walk mode)
// ================================================
const lookJoystick = document.getElementById("lookJoystick");
const lookInner = document.getElementById("lookInner");

let draggingLook = false;
let rightTouchId = null;
let rsStartX = 0,
  rsStartY = 0;
let rsTouchX = 0,
  rsTouchY = 0;
let lookLastSend = 0;

// Move inner and emit camera look velocity
function updateLookJoystick(clientX, clientY) {
  if (!draggingLook) return;
  const max = 40;
  rsTouchX = Math.max(-max, Math.min(max, clientX - rsStartX));
  rsTouchY = Math.max(-max, Math.min(max, rsStartY - clientY));
  lookInner.style.transform = `translate(calc(-50% + ${rsTouchX}px), calc(-50% - ${rsTouchY}px))`;

  const now = Date.now();
  if (now - lookLastSend < 50) return;
  lookLastSend = now;

  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "camera_look",
    payload: { x: rsTouchX, y: rsTouchY },
  });
}

// Reset inner to center and emit zero velocity
function resetLookJoystick() {
  if (!draggingLook) return;
  draggingLook = false;
  rightTouchId = null;
  rsTouchX = 0;
  rsTouchY = 0;
  lookInner.style.transform = "translate(-50%, -50%)";
  socket.emit("remote_command", {
    code: remoteState.pairedCode,
    command: "camera_look",
    payload: { x: 0, y: 0 }, // Stop camera rotation
  });
}

// Touch events for look joystick
lookJoystick.addEventListener("touchstart", (e) => {
  if (rightTouchId !== null) return;
  const touch = e.changedTouches[0];
  rightTouchId = touch.identifier;
  draggingLook = true;
  rsStartX = touch.clientX;
  rsStartY = touch.clientY;
});
document.addEventListener("touchmove", (e) => {
  if (!draggingLook || rightTouchId === null) return;
  for (let touch of e.touches) {
    if (touch.identifier === rightTouchId) {
      updateLookJoystick(touch.clientX, touch.clientY);
      break;
    }
  }
});
document.addEventListener("touchend", (e) => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === rightTouchId) resetLookJoystick();
  }
});
lookJoystick.addEventListener("pointerdown", (e) => {
  draggingLook = true;
  rsStartX = e.clientX;
  rsStartY = e.clientY;
});
window.addEventListener("pointermove", (e) => {
  if (!draggingLook) return;
  updateLookJoystick(e.clientX, e.clientY);
});
window.addEventListener("pointerup", () => {
  if (!draggingLook) return;
  resetLookJoystick();
});

// ================================================
// INIT
// ================================================
setMode("map");
render();
