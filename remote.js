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
  searchQuery: "", // For filtering units
  typeFilter: "", // For filtering by unit type
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
  // Reset search filters when navigating to a new building
  if (level === "building") {
    uiState.searchQuery = "";
    uiState.typeFilter = "";
  }
  render();
}

// goBack
function goBack() {
  uiState.stack.pop();
  // Reset search filters when going back
  uiState.searchQuery = "";
  uiState.typeFilter = "";
  render();
}

// resetSection
function resetSection(section) {
  uiState.section = section;
  uiState.stack = [];
  uiState.searchQuery = "";
  uiState.typeFilter = "";
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
     UTILITY FUNCTIONS
  ========================= */
function getUnitTypeLabel(unitType) {
  return (unitType || "").split("-")[0].trim();
}

/* =========================
     HOMES (STACK BASED WITH FILTERING)
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
    renderUnitsWithFilters(view);
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

function renderUnitsWithFilters(container) {
  const units = uiState.data.homes.units;
  const activeUnitId = getActive("unit");

  // Create toolbar with back button and filters
  const toolbar = document.createElement("div");
  toolbar.className = "list-row units-toolbar";

  const backBtn = document.createElement("div");
  backBtn.className = "units-back";
  backBtn.textContent = "\u2190";
  backBtn.onclick = goBack;

  const searchInput = document.createElement("input");
  searchInput.className = "units-search";
  searchInput.type = "text";
  searchInput.placeholder = "Search unit no.";
  searchInput.value = uiState.searchQuery || "";

  const typeFilter = document.createElement("select");
  typeFilter.className = "units-filter";
  
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All types";
  typeFilter.appendChild(allOpt);

  // Get unique unit types
  const types = [
    ...new Set(
      units
        .map((u) => getUnitTypeLabel(u.unit_type))
        .filter(Boolean),
    ),
  ];
  
  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if (t === uiState.typeFilter) opt.selected = true;
    typeFilter.appendChild(opt);
  });

  toolbar.appendChild(backBtn);
  toolbar.appendChild(searchInput);
  toolbar.appendChild(typeFilter);
  container.appendChild(toolbar);

  // Create container for filtered units
  const listWrap = document.createElement("div");
  container.appendChild(listWrap);

  // Filter and render units function
  const renderFilteredUnits = () => {
    const q = (uiState.searchQuery || "").trim().toLowerCase();
    const t = (uiState.typeFilter || "").trim().toLowerCase();

    const filtered = units.filter((u) => {
      const unitNo = String(u.unique_unit_number || "").toLowerCase();
      const typeLabel = getUnitTypeLabel(u.unit_type).toLowerCase();
      const matchNo = !q || unitNo.includes(q);
      const matchType = !t || typeLabel === t;
      return matchNo && matchType;
    });

    listWrap.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No units found";
      listWrap.appendChild(empty);
      return;
    }

    filtered.forEach((u) => {
      const row = document.createElement("div");
      row.className = "list-row unit-row";

      if (u.unit_id === activeUnitId) {
        row.classList.add("active");
      }

      row.onclick = () => {
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

      const left = document.createElement("div");
      left.className = "unit-left";
      left.textContent = u.unique_unit_number || u.unit_id || u.id || "-";

      const middle = document.createElement("div");
      middle.className = "unit-middle";

      const areaLine = document.createElement("div");
      areaLine.className = "unit-middle-line unit-area";
      const areaLabel = u.area_definition ? `${u.area_definition} Area` : "Area";
      const areaValue = u.area_of_unit ?? "-";
      const areaUnit = u.display_of_area_unit || "";
      areaLine.textContent = `${areaLabel}: ${areaValue} ${areaUnit}`;

      const divider = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      divider.setAttribute("class", "unit-divider");
      divider.setAttribute("viewBox", "0 0 240 10");
      divider.setAttribute("preserveAspectRatio", "none");
      divider.innerHTML = `
        <line x1="24" y1="5" x2="216" y2="5" stroke="#d7dbe1" stroke-width="1.5" />
      `;

      const directionLine = document.createElement("div");
      directionLine.className = "unit-middle-line unit-direction";
      directionLine.textContent = `Direction: ${u.unit_direction || "-"}`;

      middle.appendChild(areaLine);
      middle.appendChild(divider);
      middle.appendChild(directionLine);

      const badge = document.createElement("div");
      badge.className = "unit-badge";
      const typeLabel = getUnitTypeLabel(u.unit_type) || "Unit";
      badge.textContent = typeLabel;
      badge.style.backgroundColor = u.color_code || "#8a5a00";

      row.appendChild(left);
      row.appendChild(middle);
      row.appendChild(badge);
      listWrap.appendChild(row);
    });
  };

  // Event listeners for filters
  searchInput.addEventListener("input", (e) => {
    uiState.searchQuery = e.target.value || "";
    renderFilteredUnits();
  });

  typeFilter.addEventListener("change", (e) => {
    uiState.typeFilter = e.target.value || "";
    renderFilteredUnits();
  });

  // Initial render
  renderFilteredUnits();
}

/* =========================
     AMENITIES
  ========================= */
/* =========================
     AMENITIES
  ========================= */
function renderAmenities() {
  const content = document.getElementById("contentArea");
  content.innerHTML = `
    <div class="section-title">Amenities</div>
    <div class="amenities-grid" id="amenitiesView"></div>
  `;

  const container = document.getElementById("amenitiesView");
  const list = remoteUiState?.amenities || [];
  const activeAmenityId = getActive("amenity");

  console.log("Amenities list:", list);

  if (!list.length) {
    container.innerHTML = `<div class="empty">No amenities found</div>`;
    return;
  }

  // Placeholder image
  const placeholderImage = "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";

  list.forEach((a) => {
    const card = document.createElement("div");
    card.className = "amenity-card";
    
    if (a.id === activeAmenityId) {
      card.classList.add("active");
    }

    const amenityName = a.amenity_name || "";

    card.innerHTML = `
      <div class="amenity-image" style="background-image: url('${placeholderImage}')"></div>
      <div class="amenity-overlay"></div>
      <div class="amenity-name">${amenityName}</div>
    `;

    card.onclick = () => {
      // Sab cards se active class hatao
      document.querySelectorAll('.amenity-card').forEach(c => c.classList.remove('active'));
      
      // Is card ko active karo
      card.classList.add('active');
      
      // Navigate karo
      navigate("amenity", a.id);
      
      // Server ko bhejo
      socket.emit("remote_command", {
        code: pairedCode,
        command: "amenity_select",
        payload: { id: a.id },
      });
    };

    container.appendChild(card);
  });
}

// Initial render
render();