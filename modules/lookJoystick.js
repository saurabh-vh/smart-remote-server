import { socket } from "./socket.js";
import { remoteState } from "./state.js";

export function lookJoystick() {
  const lookJoystick = document.getElementById("lookJoystick");
  const lookInner = document.getElementById("lookInner");

  let draggingLook = false;
  let rightTouchId = null;
  let rsStartX = 0,
    rsStartY = 0;
  let rsTouchX = 0,
    rsTouchY = 0;
  let lookLastSend = 0;

  // Move inner and emit camera look velocity
  function updateLookJoystick(clientX, clientY) {
    if (!draggingLook) return;
    const max = 40;
    rsTouchX = Math.max(-max, Math.min(max, clientX - rsStartX));
    rsTouchY = Math.max(-max, Math.min(max, rsStartY - clientY));
    lookInner.style.transform = `translate(calc(-50% + ${rsTouchX}px), calc(-50% - ${rsTouchY}px))`;

    const now = Date.now();
    if (now - lookLastSend < 50) return;
    lookLastSend = now;

    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "camera_look",
      payload: { x: rsTouchX, y: rsTouchY },
    });
  }

  // Reset inner to center and emit zero velocity
  function resetLookJoystick() {
    if (!draggingLook) return;
    draggingLook = false;
    rightTouchId = null;
    rsTouchX = 0;
    rsTouchY = 0;
    lookInner.style.transform = "translate(-50%, -50%)";
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "camera_look",
      payload: { x: 0, y: 0 }, // Stop camera rotation
    });
  }

  // Touch events for look joystick
  lookJoystick.addEventListener("touchstart", (e) => {
    if (rightTouchId !== null) return;
    const touch = e.changedTouches[0];
    rightTouchId = touch.identifier;
    draggingLook = true;
    rsStartX = touch.clientX;
    rsStartY = touch.clientY;
  });
  document.addEventListener("touchmove", (e) => {
    if (!draggingLook || rightTouchId === null) return;
    for (let touch of e.touches) {
      if (touch.identifier === rightTouchId) {
        updateLookJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  });
  document.addEventListener("touchend", (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === rightTouchId) resetLookJoystick();
    }
  });
  lookJoystick.addEventListener("pointerdown", (e) => {
    draggingLook = true;
    rsStartX = e.clientX;
    rsStartY = e.clientY;
  });
  window.addEventListener("pointermove", (e) => {
    if (!draggingLook) return;
    updateLookJoystick(e.clientX, e.clientY);
  });
  window.addEventListener("pointerup", () => {
    if (!draggingLook) return;
    resetLookJoystick();
  });
}
