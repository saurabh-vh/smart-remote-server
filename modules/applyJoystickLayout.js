export function applyJoystickLayout(leftSide) {
  const joystickPanel = document.querySelector(".joystick-panel");
  const lookJoystick = document.getElementById("lookJoystick");
  const rubberBand = document.getElementById("rubberBand");

  if (leftSide === true) return;
  else if (leftSide === false) {
    joystickPanel.style.left = "unset";
    joystickPanel.style.right = "2.5vw";
    lookJoystick.style.right = "unset";
    lookJoystick.style.left = "3vw";
    rubberBand.style.right = "unset";
    rubberBand.style.left = "5vw";
    zoomControl.style.right = "unset";
    zoomControl.style.left = "5vw";
  }
}
