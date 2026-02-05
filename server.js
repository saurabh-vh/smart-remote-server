const path = require("path");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

// serve static files from same folder
app.use(express.static(__dirname));

const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

// simple in-memory registry: code -> socketId
const codeToSocket = new Map();

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  // Next.js instance registers its pairing code
  socket.on("register_display", ({ code }) => {
    codeToSocket.set(code, socket.id);
    socket.join(`pair:${code}`);
    console.log("registered display:", code, socket.id);
    socket.emit("registered_display", { code });
  });

  // Remote attempts to pair with a code
  socket.on("pair_remote", ({ code }) => {
    const displaySocketId = codeToSocket.get(code);
    if (!displaySocketId) {
      socket.emit("pair_error", { message: "Invalid code" });
      return;
    }

    socket.join(`pair:${code}`);
    socket.emit("pair_success", { code });
    io.to(`pair:${code}`).emit("paired", { code });
    console.log("remote paired to:", code);
  });

  // Remote sends command to display
  socket.on("remote_command", ({ code, command, payload }) => {
    io.to(`pair:${code}`).emit("remote_command", { command, payload });
  });
  socket.on("display_state", ({ code, state }) => {
    io.to(`pair:${code}`).emit("display_state", { state });
  });
  socket.on("disconnect", () => {
    // clean up if this socket was a display
    for (const [code, id] of codeToSocket.entries()) {
      if (id === socket.id) codeToSocket.delete(code);
    }
    console.log("client disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("server running on http://localhost:3001");
});
