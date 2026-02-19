document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const appEl = document.getElementById("app");

  /* =========================
     GLOBAL STATE
  ========================= */
  let pairedCode = null;
  let projectName = null;
  let remoteUiState = null;

  let activeSection = "homes";

  // Homes state
  let selectedUnits = [];
  let activeHomeBuildingId = null;
  let activeBuildingFlatId = null;
  let homeUnitSearchQuery = "";
  let homeUnitTypeFilter = "";

  // Amenities
  let activeAmenityId = null;

  /* =========================
     URL AUTO CONNECT
  ========================= */
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = params.get("code");

  const codeInputs = document.querySelectorAll(".code-input");

  if (codeFromUrl && codeFromUrl.length === 4) {
    codeFromUrl.split("").forEach((c, i) => {
      if (codeInputs[i]) codeInputs[i].value = c;
    });
    socket.emit("pair_remote", { code: codeFromUrl });
  }

  /* =========================
     CODE INPUT HANDLING
  ========================= */
  codeInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "");
      if (input.value && index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      }
      tryPair();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        codeInputs[index - 1].focus();
      }
    });
  });

  function tryPair() {
    const code = Array.from(codeInputs).map((i) => i.value).join("");
    if (code.length === 4) {
      socket.emit("pair_remote", { code });
    }
  }

  function clearCodeInputs() {
    codeInputs.forEach((i) => (i.value = ""));
    codeInputs[0].focus();
  }

  /* =========================
     MENU NAVIGATION
  ========================= */
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.onclick = () => {
      document
        .querySelectorAll(".menu-item")
        .forEach((i) => i.classList.remove("active"));

      item.classList.add("active");
      activeSection = item.dataset.section;

      // Reset per section
      if (activeSection === "homes") {
        selectedUnits = [];
        activeHomeBuildingId = null;
        activeBuildingFlatId = null;
        homeUnitSearchQuery = "";
        homeUnitTypeFilter = "";
      }

      if (activeSection === "amenities") {
        activeAmenityId = null;
      }

      renderSection();

      if (activeSection === "homes" || activeSection === "amenities") {
        socket.emit("remote_command", {
          code: pairedCode,
          command: "request_homes",
        });
      }

      if (activeSection === "location") {
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
  socket.on("pair_success", ({ code, projectName: proj, displays }) => {
    pairedCode = code;
    projectName = proj;

    document.getElementById("projectStatus").textContent =
      "Connected to " + proj;

    appEl.classList.add("connected");
    updateDisplaySelector(displays, code);
  });

  socket.on("pair_error", ({ message }) => {
    alert(message);
    clearCodeInputs();
    appEl.classList.remove("connected");
  });

  socket.on("display_state", ({ state }) => {
    remoteUiState = state;
    renderSection();
  });

  socket.on("second_level_update", ({ selectedUnits: units = [] }) => {
    selectedUnits = units;
    homeUnitSearchQuery = "";
    homeUnitTypeFilter = "";
    activeBuildingFlatId = null;
    if (activeSection === "homes") renderSection();
  });

  socket.on("switch_success", ({ code, displayName, displays }) => {
    pairedCode = code;
    document.getElementById("projectStatus").textContent =
      "Connected to " + projectName + " - " + displayName;
    updateDisplaySelector(displays, code);
  });

  socket.on("display_list_update", ({ displays }) => {
    updateDisplaySelector(displays, pairedCode);
  });

  /* =========================
     DISPLAY SELECT
  ========================= */
  const displaySelect = document.getElementById("displaySelect");

  function updateDisplaySelector(displays, currentCode) {
    displaySelect.innerHTML = "";
    displays.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.code;
      opt.textContent = d.displayName;
      if (d.code === currentCode) opt.selected = true;
      displaySelect.appendChild(opt);
    });
  }

  displaySelect.addEventListener("change", (e) => {
    const newCode = e.target.value;
    if (!newCode || newCode === pairedCode) return;

    socket.emit("switch_display", {
      newCode,
      projectName,
    });
  });

  /* =========================
     SECTION RENDER
  ========================= */
  function renderSection() {
    const content = document.getElementById("contentArea");
    content.innerHTML = "";

    if (activeSection === "homes") {
      content.innerHTML = `
        <div class="section-title">Homes Search</div>
        <div class="section-card" id="homeSearch"></div>
      `;
      renderHomeSearch();
      return;
    }

    if (activeSection === "amenities") {
      content.innerHTML = `
        <div class="section-title">Amenities</div>
        <div class="section-card" id="amenities"></div>
      `;
      renderAmenities();
      return;
    }

    if (activeSection === "location") {
      content.innerHTML = `
        <div class="section-title">Location</div>
        <div class="section-card">
          <div class="empty">Location opened on display</div>
        </div>
      `;
    }
  }

  /* =========================
     AMENITIES
  ========================= */
  function renderAmenities() {
    const container = document.getElementById("amenities");
    container.innerHTML = "";

    const list = remoteUiState?.amenities || [];

    if (!list.length) {
      container.innerHTML = `<div class="empty">No amenities found</div>`;
      return;
    }

    list.forEach((a) => {
      const row = document.createElement("div");
      row.className = "list-row";
      if (a.id === activeAmenityId) row.classList.add("active");

      row.textContent = a.amenity_name || `Amenity ${a.id}`;

      row.onclick = () => {
        activeAmenityId = a.id;
        renderAmenities();
        socket.emit("remote_command", {
          code: pairedCode,
          command: "amenity_select",
          payload: { id: a.id },
        });
      };

      container.appendChild(row);
    });
  }

  /* =========================
     HOMES
  ========================= */
  function renderHomeSearch() {
    const container = document.getElementById("homeSearch");
    container.innerHTML = "";

    // SECOND LEVEL (UNITS)
    if (selectedUnits.length) {
      const toolbar = document.createElement("div");
      toolbar.className = "list-row units-toolbar";

      const backBtn = document.createElement("div");
      backBtn.className = "units-back";
      backBtn.textContent = "←";
      backBtn.onclick = () => {
        selectedUnits = [];
        activeBuildingFlatId = null;
        socket.emit("remote_command", {
          code: pairedCode,
          command: "home_search_back",
        });
        renderSection();
      };

      toolbar.appendChild(backBtn);
      container.appendChild(toolbar);

      selectedUnits.forEach((u) => {
        const row = document.createElement("div");
        row.className = "list-row unit-row";

        if (u.unit_id === activeBuildingFlatId) {
          row.classList.add("active");
        }

        row.onclick = () => {
          activeBuildingFlatId = u.unit_id;
          renderHomeSearch();
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
        left.textContent = u.unique_unit_number || "-";

        row.appendChild(left);
        container.appendChild(row);
      });

      return;
    }

    // FIRST LEVEL (BUILDINGS)
    const buildings =
      remoteUiState?.firstLevelFilter?.selectedBuildings || [];

    if (!buildings.length) {
      container.innerHTML = `<div class="empty">No buildings found</div>`;
      return;
    }

    buildings.forEach((b) => {
      const row = document.createElement("div");
      row.className = "list-row";
      if (b.id === activeHomeBuildingId) row.classList.add("active");

      row.textContent = b.building_name || `Building ${b.id}`;

      row.onclick = () => {
        activeHomeBuildingId = b.id;
        activeBuildingFlatId = null;
        renderHomeSearch();

        socket.emit("remote_command", {
          code: pairedCode,
          command: "home_search_filter",
          payload: { id: b.id },
        });
      };

      container.appendChild(row);
    });
  }

  renderSection();
});
