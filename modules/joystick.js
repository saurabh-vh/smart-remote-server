import { socket } from "./socket.js";
import { remoteState } from "./state.js";

export function initJoystick({ getCurrentMode }) {
  const joystick = document.querySelector(".joystick");
  const stick = document.querySelector(".joystick-inner");

  let joystickDragging = false;
  let centerX = 0,
    centerY = 0;
  let lastSend = 0;
  let leftTouchId = null;

  let currentX = 0;
  let currentY = 0;
  let heartbeatInterval = null;

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

  // For Location continously drag
  function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(() => {
      if (joystickDragging && getCurrentMode() === "map") {
        if (Math.abs(currentX) > 1 || Math.abs(currentY) > 1) {
          socket.emit("remote_command", {
            code: remoteState.pairedCode,
            command: "image_drag",
            payload: {
              type: "joystick",
              action: "move",
              x: parseFloat((currentX / 35).toFixed(2)),
              y: parseFloat((-currentY / 35).toFixed(2)),
            },
          });
        }
      }
    }, 50);
  }
  function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Store joystick center on drag start
  function startJoystick(e) {
    joystickDragging = true;
    const rect = joystick.getBoundingClientRect();
    centerX = rect.width / 2;
    centerY = rect.height / 2;
    if (getCurrentMode() === "map") startHeartbeat();
  }

  // Emit joystick data — map mode sends x,y, walk mode sends WASD
  function sendDirection(limitedX, limitedY) {
    const now = Date.now();
    if (now - lastSend < 50) return;
    lastSend = now;

    if (getCurrentMode() === "map") {
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "joystick_move",
        payload: {
          type: "joystick",
          action: "move",
          x: parseFloat((limitedX / 35).toFixed(2)),
          y: parseFloat((-limitedY / 35).toFixed(2)),
        },
      });
    } else {
      const direction = getDirection(limitedX, limitedY);
      if (!direction) return;
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

    currentX = Math.max(-max, Math.min(max, x));
    currentY = Math.max(-max, Math.min(max, y));

    const limitedX = Math.max(-max, Math.min(max, x));
    const limitedY = Math.max(-max, Math.min(max, y));
    stick.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
    if (getCurrentMode() !== "map") {
      sendDirection(currentX, currentY);
    }
  }

  // Reset stick to center and emit stop
  function stopJoystick() {
    if (!joystickDragging) return;
    joystickDragging = false;

    stopHeartbeat();
    currentX = 0;
    currentY = 0;

    stick.style.transform = "translate(-50%, -50%)";
    if (getCurrentMode() === "map") {
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

  // Touch events
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
}
