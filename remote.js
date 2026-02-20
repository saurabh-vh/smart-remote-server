const socket = io();
const appEl = document.getElementById("app");

let pairedCode = null;
let projectName = null;
let remoteUiState = null;
let availableDisplays = [];

/* =========================
     SINGLE SOURCE OF TRUTH
  ========================= */
const uiState = {
  section: "homes", // homes | amenities | location
  stack: [], // navigation stack
  data: {
    homes: {
      buildings: [],
      units: [],
    },
    amenities: {},
    location: {},
  },
};

/* =========================
     URL AUTO CONNECT
  ========================= */
const params = new URLSearchParams(window.location.search);
const codeFromUrl = params.get("code");

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

function checkAndPair() {
  const code = Array.from(inputs)
    .map((i) => i.value)
    .join("");
  if (code.length === 4) {
    socket.emit("pair_remote", { code });
  }
}

/* =========================
     NAVIGATION HELPERS
  ========================= */
function navigate(level, id, extra = {}) {
  uiState.stack.push({ level, id, ...extra });
  render();
}

// goBack
function goBack() {
  uiState.stack.pop();
  render();
}

// resetSection
function resetSection(section) {
  uiState.section = section;
  uiState.stack = [];
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

    if (uiState.section === "homes" || uiState.section === "amenities") {
      socket.emit("remote_command", {
        code: pairedCode,
        command: "request_homes",
      });
    }

    if (uiState.section === "location") {
      socket.emit("remote_command", {
        code: pairedCode,
        command: "request_location",
      });
    }
  };
});

/* =========================
     SOCKET EVENTS
  ========================= */
socket.on("pair_success", ({ code, projectName: projName, displays }) => {
  pairedCode = code;
  projectName = projName;
  availableDisplays = displays;

  document.getElementById("projectStatus").textContent =
    "Connected to " + projName;

  appEl.classList.add("connected");
  updateDisplaySelector(displays, code);
});

socket.on("display_state", ({ state }) => {
  remoteUiState = state;
  uiState.data.homes.buildings =
    state?.firstLevelFilter?.selectedBuildings || [];
  render();
});

socket.on("second_level_update", ({ selectedUnits = [] }) => {
  uiState.data.homes.units = selectedUnits;
  render();
});

socket.on("display_list_update", ({ displays }) => {
  availableDisplays = displays;
  updateDisplaySelector(displays, pairedCode);
});

socket.on("pair_error", ({ message }) => {
  alert(message);
  inputs.forEach((i) => (i.value = ""));
  appEl.classList.remove("connected");
});

/* =========================
     DISPLAY SELECTOR
  ========================= */
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

document.getElementById("displaySelect").addEventListener("change", (e) => {
  const newCode = e.target.value;
  if (!newCode || newCode === pairedCode) return;

  socket.emit("switch_display", {
    newCode,
    projectName,
  });
});

socket.on("switch_success", ({ code, displayName, displays }) => {
  pairedCode = code;
  availableDisplays = displays;

  document.getElementById("projectStatus").textContent =
    "Connected to " + projectName + " - " + displayName;

  updateDisplaySelector(displays, code);
});

/* =========================
     RENDER CONTROLLER
  ========================= */
function render() {
  const content = document.getElementById("contentArea");
  content.innerHTML = "";

  if (uiState.section === "homes") renderHomes();
  if (uiState.section === "amenities") renderAmenities();
}

function getActive(level) {
  return uiState.stack.findLast((item) => item.level === level)?.id || null;
}
/* =========================
     HOMES (STACK BASED)
  ========================= */
function renderHomes() {
  const content = document.getElementById("contentArea");
  content.innerHTML = `
      <div class="section-title">Homes Search</div>
      <div class="section-card" id="homesView"></div>
    `;

  const view = document.getElementById("homesView");
  const current = uiState.stack[uiState.stack.length - 1];

  if (!current) {
    renderBuildings(view);
  } else if (current.level === "building") {
    renderUnits(view);
  }
}

function renderBuildings(container) {
  const buildings = uiState.data.homes.buildings;
  const activeBuildingId = getActive("building");

  if (!buildings.length) {
    container.innerHTML = `<div class="empty">No buildings found</div>`;
    return;
  }

  buildings.forEach((b) => {
    const row = document.createElement("div");
    row.className = "list-row";

    if (b.id === activeBuildingId) {
      row.classList.add("active");
    }

    row.textContent = b.building_name || `Building ${b.id}`;

    row.onclick = () => {
      navigate("building", b.id);
      socket.emit("remote_command", {
        code: pairedCode,
        command: "home_search_filter",
        payload: { id: b.id },
      });
    };

    container.appendChild(row);
  });
}

function renderUnits(container) {
  const units = uiState.data.homes.units;
  const activeUnitId = getActive("unit");

  const back = document.createElement("div");
  back.className = "list-row units-back";
  back.textContent = "← Back";
  back.onclick = goBack;
  container.appendChild(back);

  if (!units.length) {
    container.innerHTML += `<div class="empty">No units found</div>`;
    return;
  }

  units.forEach((u) => {
    const row = document.createElement("div");
    row.className = "list-row unit-row";

    if (u.unit_id === activeUnitId) {
      row.classList.add("active");
    }

    row.textContent = u.unique_unit_number || u.unit_id;

    row.onclick = () => {
      // 🔥 push unit level into stack
      navigate("unit", u.unit_id);

      socket.emit("remote_command", {
        code: pairedCode,
        command: "go_to_unit",
        payload: {
          unit_id: u.unit_id,
          unit_number: u.unique_unit_number,
        },
      });
    };

    container.appendChild(row);
  });
}

/* =========================
     AMENITIES
  ========================= */
function renderAmenities() {
  const content = document.getElementById("contentArea");
  content.innerHTML = `
    <div class="section-title">Amenities</div>
    <div class="section-card" id="amenitiesView"></div>
  `;

  const container = document.getElementById("amenitiesView");
  const list = remoteUiState?.amenities || [];
  const activeAmenityId = getActive("amenity");

  if (!list.length) {
    container.innerHTML = `<div class="empty">No amenities found</div>`;
    return;
  }

  list.forEach((a) => {
    const row = document.createElement("div");
    row.className = "list-row";

    if (a.id === activeAmenityId) {
      row.classList.add("active");
    }

    row.textContent = a.amenity_name;

    row.onclick = () => {
      navigate("amenity", a.id);

      socket.emit("remote_command", {
        code: pairedCode,
        command: "amenity_select",
        payload: { id: a.id },
      });
    };

    container.appendChild(row);
  });
}
render();
