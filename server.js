const path = require("path");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const server = http.createServer(app);

app.use(express.static(__dirname));

app.get("/env", (req, res) => {
  res.json({ ENV_SETUP: process.env.ENV_SETUP || "PROD" });
});

const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

const projectDisplays = new Map();
const remoteConnections = new Map();

setInterval(() => {
  fetch("https://smart-remote-server.onrender.com")
    .then(() => console.log("pinged server to prevent sleep"))
    .catch(() => console.log("failed to ping server"));
}, 50000);

// Helper — build displays array for a project
function getProjectDisplays(projectMap) {
  return Array.from(projectMap.values()).map((d) => ({
    code: d.code,
    displayName: d.displayName,
    isOccupied: !!d.remoteSocketId,
    projectName: d.projectName,
  }));
}

// Helper — emit display list update to entire project room
function emitDisplayList(projectName, projectMap) {
  const displays = getProjectDisplays(projectMap);
  io.to(`project:${projectName}`).emit("display_list_update", { displays });
  return displays;
}

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  socket.on(
    "register_display",
    ({
      code,
      projectName,
      displayName = `Display ${code}`,
      moreOptions = {},
    }) => {
      if (!projectName) {
        socket.emit("register_error", { message: "Project name required" });
        return;
      }

      if (!projectDisplays.has(projectName)) {
        projectDisplays.set(projectName, new Map());
      }

      const projectMap = projectDisplays.get(projectName);

      if (projectMap.has(code)) {
        socket.emit("register_error", {
          message: "Display code already exists for this project",
        });
        return;
      }

      projectMap.set(code, {
        socketId: socket.id,
        remoteSocketId: null,
        projectName,
        displayName,
        code,
        state: null,
        moreOptions: moreOptions || {},
      });

      socket.join(`pair:${code}`);
      socket.join(`project:${projectName}`);
      console.log(
        `registered display: ${displayName} (${code}) for project: ${projectName}`,
      );

      emitDisplayList(projectName, projectMap);
      socket.emit("registered_display", { code, projectName });
    },
  );

  socket.on("second_level_update", ({ selectedUnits = [] }) => {
    for (const [projectName, projectMap] of projectDisplays.entries()) {
      for (const [code, display] of projectMap.entries()) {
        if (display.socketId === socket.id) {
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

  socket.on("pair_remote", ({ code }) => {
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

    if (targetDisplay.remoteSocketId) {
      socket.emit("pair_error", {
        message: "Display already occupied by another remote",
      });
      return;
    }

    if (remoteConnections.has(socket.id)) {
      const currentPair = remoteConnections.get(socket.id);
      const oldProjectMap = projectDisplays.get(currentPair.projectName);
      if (oldProjectMap && oldProjectMap.has(currentPair.code)) {
        oldProjectMap.get(currentPair.code).remoteSocketId = null;
        emitDisplayList(currentPair.projectName, oldProjectMap);
      }
    }

    targetDisplay.remoteSocketId = socket.id;
    remoteConnections.set(socket.id, { code, projectName: targetProject });

    socket.join(`pair:${code}`);
    socket.join(`project:${targetProject}`);

    const displays = emitDisplayList(targetProject, targetProjectMap);

    socket.emit("pair_success", {
      code,
      projectName: targetProject,
      displays,
      currentDisplay: targetDisplay.displayName,
      moreOptions: targetDisplay.moreOptions,
    });

    io.to(`pair:${code}`).emit("paired", { code });

    console.log(
      `remote ${socket.id} paired to: ${code} (${targetDisplay.displayName}) in project: ${targetProject}`,
    );
  });

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

  socket.on("remote_command", ({ code, command, payload }) => {
    io.to(`pair:${code}`).emit("remote_command", { command, payload });
  });

  socket.on("display_state", ({ code, projectName, state }) => {
    const projectMap = projectDisplays.get(projectName);
    if (projectMap && projectMap.has(code)) {
      const display = projectMap.get(code);
      display.state = state;
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

  socket.on("switch_display", ({ newCode, projectName }) => {
    const remoteData = remoteConnections.get(socket.id);
    if (!remoteData) {
      socket.emit("switch_error", { message: "Remote not paired" });
      return;
    }

    const currentProjectName = remoteData.projectName;
    const projectMap = projectDisplays.get(currentProjectName);

    if (!projectMap || !projectMap.has(newCode)) {
      socket.emit("switch_error", {
        message: "Invalid display code or not in same project",
      });
      return;
    }

    const newDisplay = projectMap.get(newCode);

    if (newDisplay.remoteSocketId && newDisplay.remoteSocketId !== socket.id) {
      socket.emit("switch_error", {
        message: "Display already occupied by another remote",
      });
      return;
    }

    socket.leave(`pair:${remoteData.code}`);

    const oldDisplay = projectMap.get(remoteData.code);
    if (oldDisplay) oldDisplay.remoteSocketId = null;

    newDisplay.remoteSocketId = socket.id;
    socket.join(`pair:${newCode}`);

    remoteConnections.set(socket.id, {
      code: newCode,
      projectName: currentProjectName,
    });

    const displays = emitDisplayList(currentProjectName, projectMap);

    socket.emit("switch_success", {
      code: newCode,
      displayName: newDisplay.displayName,
      displays,
    });

    if (newDisplay.state) {
      socket.emit("display_state", {
        state: newDisplay.state,
        currentDisplay: newDisplay.displayName,
        currentDisplayCode: newCode,
        projectName: currentProjectName,
      });
    }

    console.log(
      `remote ${socket.id} switched to: ${newCode} (${newDisplay.displayName}) in project: ${currentProjectName}`,
    );
  });

  socket.on("unpair_remote", ({ code } = {}) => {
    if (!remoteConnections.has(socket.id)) return;

    const { code: currentCode, projectName } = remoteConnections.get(socket.id);
    const unpairCode = code || currentCode;

    remoteConnections.delete(socket.id);

    const projectMap = projectDisplays.get(projectName);
    if (projectMap && projectMap.has(unpairCode)) {
      const display = projectMap.get(unpairCode);
      if (display.remoteSocketId === socket.id) display.remoteSocketId = null;
      emitDisplayList(projectName, projectMap);
      console.log(
        `remote unpaired: ${socket.id} from ${unpairCode} (project: ${projectName})`,
      );
    } else {
      console.log(`remote unpaired (no matching display): ${socket.id}`);
    }
  });

  socket.on("disconnect", () => {
    for (const [projectName, projectMap] of projectDisplays.entries()) {
      for (const [code, display] of projectMap.entries()) {
        if (display.socketId === socket.id) {
          projectMap.delete(code);
          if (projectMap.size === 0) {
            projectDisplays.delete(projectName);
          } else {
            emitDisplayList(projectName, projectMap);
          }
          console.log(
            `display disconnected: ${code} from project: ${projectName}`,
          );
          break;
        }
      }
    }

    if (remoteConnections.has(socket.id)) {
      const { code, projectName } = remoteConnections.get(socket.id);
      remoteConnections.delete(socket.id);

      const projectMap = projectDisplays.get(projectName);
      if (projectMap && projectMap.has(code)) {
        projectMap.get(code).remoteSocketId = null;
        emitDisplayList(projectName, projectMap);
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
