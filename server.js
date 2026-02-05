const path = require("path");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

// serve static files from the same folder
app.use(express.static(__dirname));

const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  socket.on("hi", (msg) => {
    console.log("hi from html:", msg);
    io.emit("hi", msg);
  });
});

server.listen(3001, () => {
  console.log("server running on http://localhost:3001");
});
