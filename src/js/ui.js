// ui.js
// Handles DOM interactions, layout logic, and rendering of timer state and sidebar controls.

import {
  getPlanSettings,
  updatePlanSettings,
  getPreferences,
  updatePreferences,
  getTheme,
  setTheme,
} from "./state.js";
import {
  onTimerEvent,
  performPrimaryAction,
  resetTimer,
  applyPlanSettings,
  getTimerState,
} from "./timer.js";

const pickerLimits = {
  focusMinutes: { min: 5, max: 120 },
  relaxMinutes: { min: 1, max: 60 },
  cycles: { min: 1, max: 12 },
};

let pickerValues = { ...getPlanSettings() };
let toastTimeout;

export function initUI() {
  const body = document.body;
  body.style.touchAction = "manipulation";

  const timeOutput = document.getElementById("time-output");
  const statusLabel = document.getElementById("status-label");
  const primaryButton = document.getElementById("primary-action");
  const resetButton = document.getElementById("reset-action");
  const timerCircle = document.getElementById("timer-circle");
  const progressCircle = document.querySelector(".ring-progress");
  const circumference = 2 * Math.PI * 108;
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarClose = document.getElementById("sidebar-close");
  const overlay = document.getElementById("overlay");
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");
  const pickers = document.querySelectorAll(".number-picker");
  const summary = document.getElementById("plan-summary");
  const applyPlanButton = document.getElementById("apply-plan");
  const savePlanButton = document.getElementById("save-plan");
  const autoCycleToggle = document.getElementById("auto-cycle");
  const soundToggle = document.getElementById("sound-toggle");
  const themeButtons = document.querySelectorAll(".theme-button");
  const signInButton = document.getElementById("sign-in");
  const toast = document.getElementById("toast");
  const cyclesLeftNode = document.getElementById("cycles-left");
  const totalRemainingNode = document.getElementById("total-remaining");

  progressCircle.style.strokeDasharray = circumference.toString();

  // Circular progress ring uses stroke-dashoffset to animate remaining time.
  const updateProgress = (state) => {
    const { remainingSeconds, durationSeconds } = state;
    const safeDuration = durationSeconds || 1;
    const ratio = Math.min(1, Math.max(0, remainingSeconds / safeDuration));
    const offset = circumference * (1 - ratio);
    progressCircle.style.strokeDashoffset = offset;
  };

  const updateTone = (tone) => {
    body.dataset.tone = tone;
  };

  const updateCycleInfo = (state) => {
    cyclesLeftNode.textContent = `Cycles left: ${state.cyclesLeft}`;
    totalRemainingNode.textContent = `Total remaining: ${formatDurationFromSeconds(
      state.totalRemainingSeconds
    )}`;
  };

  const updateDisplay = (state, message) => {
    timeOutput.textContent = formatTime(state.remainingSeconds);
    statusLabel.textContent = state.statusLabel;
    primaryButton.textContent = state.primaryLabel;
    updateProgress(state);
    updateTone(state.tone);
    updateCycleInfo(state);
    if (message) {
      showToast(message, toast);
    }
  };

  onTimerEvent("timer:update", (event) =>
    updateDisplay(event.detail, event.detail.message)
  );
  updateDisplay(getTimerState());

  primaryButton.addEventListener("click", () => performPrimaryAction());
  timerCircle.addEventListener("click", () => performPrimaryAction());
  timerCircle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      performPrimaryAction();
    }
  });

  resetButton.addEventListener("click", () => {
    resetTimer();
  });

  sidebarToggle.addEventListener("click", () => openSidebar(body));
  sidebarClose.addEventListener("click", () => closeSidebar(body));
  overlay.addEventListener("click", () => closeSidebar(body));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar(body);
    }
  });

  // Sidebar tab buttons toggle Configure/Select panels.
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle("active", isActive);
        t.setAttribute("aria-selected", isActive.toString());
      });
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `${target}-panel`);
      });
    });
  });

  // Number pickers with keyboard input and long-press step controls.
  pickers.forEach((picker) => setupPicker(picker, summary));

  updateSummaryText(summary);

  applyPlanButton.addEventListener("click", () => {
    updatePlanSettings({
      focusMinutes: pickerValues.focusMinutes,
      relaxMinutes: pickerValues.relaxMinutes,
      cycles: pickerValues.cycles,
    });
    applyPlanSettings();
    closeSidebar(body);
    showToast("Plan applied", toast);
  });

  savePlanButton.addEventListener("click", () => {
    showToast("Plan saved (placeholder)", toast);
  });

  const preferences = getPreferences();
  autoCycleToggle.checked = preferences.autoCycle;
  soundToggle.checked = preferences.sound;

  autoCycleToggle.addEventListener("change", () => {
    updatePreferences({ autoCycle: autoCycleToggle.checked });
  });

  soundToggle.addEventListener("change", () => {
    updatePreferences({ sound: soundToggle.checked });
  });

  const currentTheme = getTheme();
  applyTheme(body, currentTheme, themeButtons);

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      setTheme(theme);
      applyTheme(body, theme, themeButtons);
    });
  });

  signInButton.addEventListener("click", () => {
    showToast("Sign in coming soon", toast);
  });
}

function setupPicker(picker, summaryNode) {
  const field = picker.dataset.field;
  const input = picker.querySelector("[data-field-value]");
  input.value = pickerValues[field];
  const controls = picker.querySelectorAll(".picker-control");
  let holdInterval;
  let holdTimeout;

  const stepValue = (delta) => {
    const limits = pickerLimits[field];
    const next = clamp(
      parseInt(input.value, 10) + delta,
      limits.min,
      limits.max
    );
    pickerValues[field] = next;
    input.value = next;
    updateSummaryText(summaryNode);
  };

  const stopHold = () => {
    clearInterval(holdInterval);
    clearTimeout(holdTimeout);
  };

  const startHold = (delta) => {
    stepValue(delta);
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => stepValue(delta), 100);
    }, 300);
  };

  controls.forEach((control) => {
    const delta = control.dataset.direction === "up" ? 1 : -1;
    control.addEventListener("mousedown", (event) => {
      event.preventDefault();
      startHold(delta);
    });
    control.addEventListener("touchstart", (event) => {
      event.preventDefault();
      startHold(delta);
    });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((evt) => {
      control.addEventListener(evt, stopHold);
    });
  });

  input.addEventListener("input", () => {
    const limits = pickerLimits[field];
    const parsed = parseInt(input.value || "0", 10);
    pickerValues[field] = clamp(parsed, limits.min, limits.max);
  });

  input.addEventListener("blur", () => {
    const limits = pickerLimits[field];
    pickerValues[field] = clamp(
      parseInt(input.value, 10) || limits.min,
      limits.min,
      limits.max
    );
    input.value = pickerValues[field];
    updateSummaryText(summaryNode);
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDurationFromSeconds(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateSummaryText(node) {
  const focus = pickerValues.focusMinutes;
  const relax = pickerValues.relaxMinutes;
  const cycles = pickerValues.cycles;
  const total = focus * cycles + relax * cycles;
  node.textContent = `${focus} / ${relax} × ${cycles} ≈ ${formatDurationFromSeconds(
    total * 60
  )}`;
}

function openSidebar(body) {
  body.classList.add("sidebar-open");
}

function closeSidebar(body) {
  body.classList.remove("sidebar-open");
}

function showToast(message, node) {
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.classList.add("visible");
  toastTimeout = setTimeout(() => {
    node.classList.remove("visible");
  }, 2400);
}

function applyTheme(body, theme, buttons) {
  body.setAttribute("data-theme", theme);
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === theme);
  });
}
