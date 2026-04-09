export function setRecenterClose() {
  const recenterBtn = document.getElementById("recenterBtn");
  recenterBtn.style.display = "flex";
  recenterBtn.textContent = "CLOSE";
  recenterBtn.classList.add("close-mode");
}
export function resetRecenterBtn() {
  const recenterBtn = document.getElementById("recenterBtn");
  recenterBtn.style.display = "";
  recenterBtn.textContent = "RECENTER VIEW";
  recenterBtn.classList.remove("close-mode");
}
