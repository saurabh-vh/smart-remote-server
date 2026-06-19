import { socket } from "./socket.js";
import { remoteState, uiState } from "./state.js";

export function initRubberBand() {
  const rubberBand = document.getElementById("rubberBand");
  const rubberInner = document.getElementById("rubberInner");

  let rubberDragging = false;
  let rubberTouchId = null;
  let rubberStartY = 0;
  let rubberOffsetY = 0;
  let rubberLastSend = 0;
  const RUBBER_MAX = 80;

  // Move rubber inner and emit zoom strength
  function updateRubber(clientY) {
    rubberOffsetY = clientY - rubberStartY;
    rubberOffsetY = Math.max(-RUBBER_MAX, Math.min(RUBBER_MAX, rubberOffsetY));
    rubberInner.style.transform = `translate(-50%, calc(-50% + ${rubberOffsetY}px))`;

    const now = Date.now();

    const isLocation = uiState.section === "location";
    const THROTTLE_MS = isLocation ? 200 : 50;
    const MAX_STRENGTH = isLocation ? 0.01 : 1;

    if (now - rubberLastSend < THROTTLE_MS) return;
    rubberLastSend = now;
    const raw = Math.abs(rubberOffsetY) / RUBBER_MAX;

    const strength = isLocation
      ? parseFloat(Math.min(raw * raw * MAX_STRENGTH, MAX_STRENGTH).toFixed(4))
      : parseFloat((Math.abs(rubberOffsetY) / RUBBER_MAX).toFixed(2));
    const minThreshold = isLocation ? 0.001 : 0.05;
    if (strength < minThreshold) return;

    // console.log(`[Zoom] direction: ${rubberOffsetY < 0 ? "in" : "out"}, strength: ${strength}`,);

    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "zoom",
      payload: {
        type: "zoom",
        action: "start",
        direction: rubberOffsetY < 0 ? 1 : -1,
        strength,
      },
    });
  }

  // Snap inner back to center and emit stop
  function resetRubber() {
    rubberDragging = false;
    rubberTouchId = null;
    rubberOffsetY = 0;
    rubberInner.style.transform = "translate(-50%, -50%)";
    socket.emit("remote_command", {
      code: remoteState.pairedCode,
      command: "zoom",
      payload: { type: "zoom", action: "stop", direction: 0, strength: 0 },
    });
  }

  rubberBand.addEventListener("touchstart", (e) => {
    if (rubberTouchId !== null) return;
    const touch = e.changedTouches[0];
    rubberTouchId = touch.identifier;
    rubberDragging = true;
    rubberStartY = touch.clientY;
  });
  document.addEventListener("touchmove", (e) => {
    if (!rubberDragging || rubberTouchId === null) return;
    for (let touch of e.touches) {
      if (touch.identifier === rubberTouchId) {
        updateRubber(touch.clientY);
        break;
      }
    }
  });
  document.addEventListener("touchend", (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === rubberTouchId) resetRubber();
    }
  });
  rubberBand.addEventListener("pointerdown", (e) => {
    rubberDragging = true;
    rubberStartY = e.clientY;
  });
  window.addEventListener("pointermove", (e) => {
    if (!rubberDragging) return;
    updateRubber(e.clientY);
  });
  window.addEventListener("pointerup", () => {
    if (!rubberDragging) return;
    resetRubber();
  });
}
