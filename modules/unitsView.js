import { uiState } from "./state.js";

export function renderUnitsWithFilters(
  container,
  {
    socket,
    pairedCode,
    goBack,
    getActive,
    getUnitTypeLabel,
    setMode,
    navigate,
  },
) {
  const units = uiState.data.homes.units;
  const activeUnitId = getActive("unit");

  const toolbar = document.createElement("div");
  toolbar.className = "list-row units-toolbar";

  const backBtn = document.createElement("div");
  backBtn.className = "units-back";
  backBtn.textContent = "\u2190";
  backBtn.onclick = goBack;

  // active building title
  const buildingTitle = document.createElement("div");
  buildingTitle.className = "units-building-title";
  const activeBuilding = uiState.stack.findLast((s) => s.level === "building");
  const buildingData = uiState.data.homes.buildings.find(
    (b) => b.id === activeBuilding?.id,
  );

  buildingTitle.textContent = activeBuilding?.wingName
    ? `${activeBuilding?.wingName}`
    : activeBuilding?.buildingName ||
      buildingData?.building_name ||
      `Building ${activeBuilding?.id || ""}`;

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

  const types = [
    ...new Set(units.map((u) => getUnitTypeLabel(u.unit_type)).filter(Boolean)),
  ];
  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if (t === uiState.typeFilter) opt.selected = true;
    typeFilter.appendChild(opt);
  });

  toolbar.appendChild(backBtn);
  toolbar.appendChild(buildingTitle);
  toolbar.appendChild(searchInput);
  toolbar.appendChild(typeFilter);
  container.appendChild(toolbar);

  const listWrap = document.createElement("div");
  container.appendChild(listWrap);

  const renderFilteredUnits = () => {
    const q = (uiState.searchQuery || "").trim().toLowerCase();
    const t = (uiState.typeFilter || "").trim().toLowerCase();
    const filtered = units.filter((u) => {
      const unitNo = String(u.unique_unit_number || "").toLowerCase();
      const typeLabel = getUnitTypeLabel(u.unit_type).toLowerCase();
      return (!q || unitNo.includes(q)) && (!t || typeLabel === t);
    });

    listWrap.innerHTML = "";

    if (units.length === 0) {
      listWrap.innerHTML = `
      <style>
      @keyframes dotBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-8px); opacity: 1; }
      }
    </style>
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:10vh;">
      <div style="display:flex; gap:6px; align-items:center;">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--accent); display:inline-block; animation: dotBounce 1.2s infinite ease-in-out;"></span>
        <span style="width:8px; height:8px; border-radius:50%; background:var(--accent); display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.2s;"></span>
        <span style="width:8px; height:8px; border-radius:50%; background:var(--accent); display:inline-block; animation: dotBounce 1.2s infinite ease-in-out 0.4s;"></span>
      </div>
            <div style="font-size:13px; color:var(--text-muted); font-weight:500; letter-spacing:0.5px;">Loading units...</div>
    </div>
  `;
      return;
    }
    if (filtered.length === 0) {
      listWrap.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:10vh;">
      <div style="font-size:13px; color:var(--text-muted); font-weight:500; letter-spacing:0.5px;">No results found</div>
    </div>
  `;
      return;
    }

    filtered.reverse().forEach((u) => {
      const row = document.createElement("div");
      row.className = "list-row unit-row";
      if (u.unit_id === activeUnitId) row.classList.add("active");

      row.onclick = () => {
        document
          .querySelectorAll(".unit-row")
          .forEach((r) => r.classList.remove("active"));
        row.classList.add("active");
        setMode("walk");

        navigate("unit", u.unit_id, {
          unitNumber: u.unique_unit_number,
          buildingName: activeBuilding?.buildingName,
          wingName: activeBuilding?.wingName,
        });

        socket.emit("remote_command", {
          code: pairedCode,
          command: "go_to_unit",
          payload: { unit_id: u.unit_id, unit_number: u.unique_unit_number },
        });
      };

      const left = document.createElement("div");
      left.className = "unit-left";
      left.textContent = u.unique_unit_number || u.unit_id || u.id || "-";

      const middle = document.createElement("div");
      middle.className = "unit-middle";

      const areaLine = document.createElement("div");
      areaLine.className = "unit-middle-line unit-area";
      areaLine.textContent = `${u.area_definition ? u.area_definition + " Area" : "Area"}: ${u.area_of_unit ?? "-"} ${u.display_of_area_unit || ""}`;

      const divider = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      divider.setAttribute("class", "unit-divider");
      divider.setAttribute("viewBox", "0 0 240 10");
      divider.setAttribute("preserveAspectRatio", "none");
      divider.style.color = "var(--divider-stroke)";
      divider.innerHTML = `<line x1="24" y1="5" x2="216" y2="5" stroke="currentColor" stroke-width="1.5" />`;

      const directionLine = document.createElement("div");
      directionLine.className = "unit-middle-line unit-direction";
      directionLine.textContent = `Direction: ${u.unit_direction || "-"}`;

      middle.appendChild(areaLine);
      middle.appendChild(divider);
      middle.appendChild(directionLine);

      const badge = document.createElement("div");
      badge.className = "unit-badge";
      badge.textContent = getUnitTypeLabel(u.unit_type) || "Unit";
      badge.style.backgroundColor = u.color_code || "#8a5a00";

      row.appendChild(left);
      row.appendChild(middle);
      row.appendChild(badge);
      listWrap.appendChild(row);
    });
  };

  searchInput.addEventListener("input", (e) => {
    uiState.searchQuery = e.target.value || "";
    renderFilteredUnits();
  });
  typeFilter.addEventListener("change", (e) => {
    uiState.typeFilter = e.target.value || "";
    renderFilteredUnits();
  });

  renderFilteredUnits();
}
