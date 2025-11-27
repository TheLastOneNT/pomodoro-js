// main.js
// Entry point that wires the UI together once DOM content is ready.

import { initUI } from "./ui.js";

window.addEventListener("DOMContentLoaded", () => {
  initUI();
});

document.addEventListener(
  "touchstart",
  function (event) {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);

let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);

["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
  window.addEventListener(
    type,
    function (event) {
      event.preventDefault();
    },
    { passive: false }
  );
});
