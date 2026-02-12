const path = require("path");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(express.static(__dirname));

const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

// Registry: projectName -> { code: { socketId, remoteSocketId, projectName, displayName } }
const projectDisplays = new Map(); // projectName -> Map(code -> displayData)
const remoteConnections = new Map(); // remoteSocketId -> { code, projectName }
setInterval(() => {
  fetch("https://smart-remote-server.onrender.com")
    .then(() => {
      console.log("pinged server to prevent sleep");
    })
    .catch(() => {
      console.log("failed to ping server");
    });
}, 10000);
io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  // Display registers with code and project name
  socket.on(
    "register_display",
    ({ code, projectName, displayName = `Display ${code}` }) => {
      if (!projectName) {
        socket.emit("register_error", { message: "Project name required" });
        return;
      }

      // Initialize project map if not exists
      if (!projectDisplays.has(projectName)) {
        projectDisplays.set(projectName, new Map());
      }

      const projectMap = projectDisplays.get(projectName);

      // Check if display with this code already exists in this project
      if (projectMap.has(code)) {
        socket.emit("register_error", {
          message: "Display code already exists for this project",
        });
        return;
      }

      // Register display
      projectMap.set(code, {
        socketId: socket.id,
        remoteSocketId: null,
        projectName,
        displayName,
        code,
        state: null,
      });

      socket.join(`pair:${code}`);
      socket.join(`project:${projectName}`);
      console.log(
        `registered display: ${displayName} (${code}) for project: ${projectName}`,
      );

      // Send list of all displays for THIS PROJECT ONLY
      const displays = Array.from(projectMap.values()).map((d) => ({
        code: d.code,
        displayName: d.displayName,
        isOccupied: !!d.remoteSocketId,
        projectName: d.projectName,
      }));

      io.to(`project:${projectName}`).emit("display_list_update", { displays });
      socket.emit("registered_display", { code, projectName });
    },
  );
  // Display sends second-level selection update
  socket.on("second_level_update", ({ selectedUnits = [] }) => {
    for (const [projectName, projectMap] of projectDisplays.entries()) {
      for (const [code, display] of projectMap.entries()) {
        if (display.socketId === socket.id) {
          // optional: cache latest second-level payload on display object
          display.secondLevelState = { selectedUnits };

          if (display.remoteSocketId) {
            io.to(display.remoteSocketId).emit("second_level_update", {
              selectedUnits,
              currentDisplay: display.displayName,
              currentDisplayCode: code,
              projectName,
            });
          }
          return;
        }
      }
    }
  });

  // Remote attempts to pair with a code (no project name needed)
  socket.on("pair_remote", ({ code }) => {
    // Find which project this display code belongs to
    let targetDisplay = null;
    let targetProject = null;
    let targetProjectMap = null;

    for (const [projectName, projectMap] of projectDisplays.entries()) {
      if (projectMap.has(code)) {
        targetDisplay = projectMap.get(code);
        targetProject = projectName;
        targetProjectMap = projectMap;
        break;
      }
    }

    if (!targetDisplay) {
      socket.emit("pair_error", { message: "Invalid display code" });
      return;
    }

    // Check if display is already occupied
    if (targetDisplay.remoteSocketId) {
      socket.emit("pair_error", {
        message: "Display already occupied by another remote",
      });
      return;
    }

    // Check if remote is already paired with another display
    if (remoteConnections.has(socket.id)) {
      const currentPair = remoteConnections.get(socket.id);
      const oldProjectMap = projectDisplays.get(currentPair.projectName);
      if (oldProjectMap && oldProjectMap.has(currentPair.code)) {
        oldProjectMap.get(currentPair.code).remoteSocketId = null;

        // Update display list for OLD PROJECT
        const oldDisplays = Array.from(oldProjectMap.values()).map((d) => ({
          code: d.code,
          displayName: d.displayName,
          isOccupied: !!d.remoteSocketId,
          projectName: d.projectName,
        }));
        io.to(`project:${currentPair.projectName}`).emit(
          "display_list_update",
          { displays: oldDisplays },
        );
      }
    }

    // Establish new connection
    targetDisplay.remoteSocketId = socket.id;
    remoteConnections.set(socket.id, { code, projectName: targetProject });

    socket.join(`pair:${code}`);
    socket.join(`project:${targetProject}`);

    // Get all displays for THIS PROJECT ONLY
    const displays = Array.from(targetProjectMap.values()).map((d) => ({
      code: d.code,
      displayName: d.displayName,
      isOccupied: !!d.remoteSocketId,
      projectName: d.projectName,
    }));

    socket.emit("pair_success", {
      code,
      projectName: targetProject,
      displays,
      currentDisplay: targetDisplay.displayName,
    });

    io.to(`pair:${code}`).emit("paired", { code });

    // Update display list for ALL IN THIS PROJECT
    io.to(`project:${targetProject}`).emit("display_list_update", { displays });

    console.log(
      `remote ${socket.id} paired to: ${code} (${targetDisplay.displayName}) in project: ${targetProject}`,
    );
  });
  /* =========================
   Cursor Client (Windows EXE)
   Attach to existing display
========================= */
  socket.on("register_cursor_client", ({ code }) => {
    let foundProject = null;

    for (const [projectName, map] of projectDisplays.entries()) {
      if (map.has(code)) {
        foundProject = projectName;
        break;
      }
    }

    if (!foundProject) {
      socket.emit("cursor_error", { message: "Invalid display code" });
      return;
    }

    socket.join(`pair:${code}`);
    console.log(`Cursor client attached to ${code}`);
  });

  // Remote sends command to display
  socket.on("remote_command", ({ code, command, payload }) => {
    io.to(`pair:${code}`).emit("remote_command", { command, payload });
  });

  // Display sends state update
  socket.on("display_state", ({ code, projectName, state }) => {
    const projectMap = projectDisplays.get(projectName);
    if (projectMap && projectMap.has(code)) {
      projectMap.get(code).state = state;

      // Send state to the connected remote if any
      const display = projectMap.get(code);
      if (display.remoteSocketId) {
        io.to(display.remoteSocketId).emit("display_state", {
          state,
          currentDisplay: display.displayName,
          currentDisplayCode: code,
          projectName,
        });
      }
    }
  });

  // Remote switches to another display (within the same project)
  socket.on("switch_display", ({ newCode, projectName }) => {
    const remoteData = remoteConnections.get(socket.id);
    if (!remoteData) {
      socket.emit("switch_error", { message: "Remote not paired" });
      return;
    }

    // Get project from remote's current connection
    const currentProjectName = remoteData.projectName;
    const projectMap = projectDisplays.get(currentProjectName);

    if (!projectMap || !projectMap.has(newCode)) {
      socket.emit("switch_error", {
        message: "Invalid display code or not in same project",
      });
      return;
    }

    const newDisplay = projectMap.get(newCode);

    // Check if new display is already occupied
    if (newDisplay.remoteSocketId && newDisplay.remoteSocketId !== socket.id) {
      socket.emit("switch_error", {
        message: "Display already occupied by another remote",
      });
      return;
    }

    // Leave old pair room
    socket.leave(`pair:${remoteData.code}`);

    // Remove from old display
    const oldDisplay = projectMap.get(remoteData.code);
    if (oldDisplay) {
      oldDisplay.remoteSocketId = null;
    }

    // Join new pair room
    newDisplay.remoteSocketId = socket.id;
    socket.join(`pair:${newCode}`);

    // Update remote connection
    remoteConnections.set(socket.id, {
      code: newCode,
      projectName: currentProjectName,
    });

    // Get updated display list for THIS PROJECT ONLY
    const displays = Array.from(projectMap.values()).map((d) => ({
      code: d.code,
      displayName: d.displayName,
      isOccupied: !!d.remoteSocketId,
      projectName: d.projectName,
    }));

    // Send success to remote
    socket.emit("switch_success", {
      code: newCode,
      displayName: newDisplay.displayName,
      displays,
    });

    // Send state of new display to remote
    if (newDisplay.state) {
      socket.emit("display_state", {
        state: newDisplay.state,
        currentDisplay: newDisplay.displayName,
        currentDisplayCode: newCode,
        projectName: currentProjectName,
      });
    }

    // Update display list for ALL IN THIS PROJECT
    io.to(`project:${currentProjectName}`).emit("display_list_update", {
      displays,
    });

    console.log(
      `remote ${socket.id} switched to: ${newCode} (${newDisplay.displayName}) in project: ${currentProjectName}`,
    );
  });

  socket.on("disconnect", () => {
    // Check if this was a display
    for (const [projectName, projectMap] of projectDisplays.entries()) {
      for (const [code, display] of projectMap.entries()) {
        if (display.socketId === socket.id) {
          // Remove display from registry
          projectMap.delete(code);

          // If project has no more displays, remove project
          if (projectMap.size === 0) {
            projectDisplays.delete(projectName);
          } else {
            // Update display list for THIS PROJECT ONLY
            const displays = Array.from(projectMap.values()).map((d) => ({
              code: d.code,
              displayName: d.displayName,
              isOccupied: !!d.remoteSocketId,
              projectName: d.projectName,
            }));
            io.to(`project:${projectName}`).emit("display_list_update", {
              displays,
            });
          }

          console.log(
            `display disconnected: ${code} from project: ${projectName}`,
          );
          break;
        }
      }
    }

    // Check if this was a remote
    if (remoteConnections.has(socket.id)) {
      const { code, projectName } = remoteConnections.get(socket.id);
      remoteConnections.delete(socket.id);

      const projectMap = projectDisplays.get(projectName);
      if (projectMap && projectMap.has(code)) {
        const display = projectMap.get(code);
        display.remoteSocketId = null;

        // Update display list for THIS PROJECT ONLY
        const displays = Array.from(projectMap.values()).map((d) => ({
          code: d.code,
          displayName: d.displayName,
          isOccupied: !!d.remoteSocketId,
          projectName: d.projectName,
        }));
        io.to(`project:${projectName}`).emit("display_list_update", {
          displays,
        });
      }

      console.log(
        `remote disconnected: ${socket.id} from ${code} (project: ${projectName})`,
      );
    }
  });
});

server.listen(3001, () => {
  console.log("server running on http://localhost:3001");
});
