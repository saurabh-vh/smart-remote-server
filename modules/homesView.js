import { socket } from "./socket.js";
import { remoteState, uiState } from "./state.js";
import { renderUnitsWithFilters } from "./unitsView.js";

export function renderHomes({
  goBack,
  getActive,
  getUnitTypeLabel,
  setMode,
  navigate,
}) {
  const content = document.getElementById("contentArea");

  const hasWings = uiState.data.homes.buildings.some(
    (b) => b.wings && b.wings.length > 0,
  );

  content.innerHTML = `<div class="section-card ${hasWings ? "section-card-wings" : ""}" id="homesView"></div>`;

  const view = document.getElementById("homesView");
  const current = uiState.stack[uiState.stack.length - 1];
  document.querySelectorAll(".ellipsis-wrapper").forEach((el) => {
    el.style.display = "";
  });

  if (!current || current.level === "selectedBuilding") {
    renderBuildings(view, { getActive, navigate });
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
    document.querySelectorAll(".ellipsis-wrapper").forEach((el) => {
      el.style.display = "none";
    });
    renderTakeMeTo(view, { getActive, goBack });
  }
}

function renderBuildings(container, { getActive, navigate }) {
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

function renderTakeMeTo(container, { getActive, goBack }) {
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
