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

  // Store joystick center on drag start
  function startJoystick(e) {
    joystickDragging = true;
    const rect = joystick.getBoundingClientRect();
    centerX = rect.width / 2;
    centerY = rect.height / 2;
  }

  // Emit joystick data — map mode sends x,y, walk mode sends WASD
  function sendDirection(limitedX, limitedY) {
    const now = Date.now();
    if (now - lastSend < 50) return;
    lastSend = now;

    // For image gallery joystick
    if (document.querySelector(".image-wrapper")) {
      socket.emit("remote_command", {
        code: remoteState.pairedCode,
        command: "image_drag",
        payload: { x: limitedX, y: -limitedY },
      });
      return;
    }

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
    const limitedX = Math.max(-max, Math.min(max, x));
    const limitedY = Math.max(-max, Math.min(max, y));
    stick.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
    sendDirection(limitedX, limitedY);
  }

  // Reset stick to center and emit stop
  function stopJoystick() {
    if (!joystickDragging) return;
    joystickDragging = false;
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
