// ui.js
// Handles DOM interactions, layout logic, and rendering of timer state.

import {
  getPlanSettings,
  updatePlanSettings,
  getPreferences,
  updatePreferences,
  getTheme,
  setTheme,
} from './state.js';
import { onTimerEvent, toggleTimer, resetTimer, selectMode, applyPlanSettings, getTimerState } from './timer.js';

const pickerLimits = {
  focusMinutes: { min: 5, max: 120 },
  breakMinutes: { min: 1, max: 60 },
  cycles: { min: 1, max: 12 },
};

let pickerValues = { ...getPlanSettings() };
let toastTimeout;

export function initUI() {
  const body = document.body;
  const timeOutput = document.getElementById('time-output');
  const statusLabel = document.getElementById('status-label');
  const primaryButton = document.getElementById('primary-action');
  const resetButton = document.getElementById('reset-action');
  const timerCircle = document.getElementById('timer-circle');
  const progressCircle = document.querySelector('.ring-progress');
  const circumference = 2 * Math.PI * 108;
  const modeButtons = document.querySelectorAll('.mode-button');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const overlay = document.getElementById('overlay');
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  const pickers = document.querySelectorAll('.number-picker');
  const summary = document.getElementById('plan-summary');
  const applyPlanButton = document.getElementById('apply-plan');
  const savePlanButton = document.getElementById('save-plan');
  const autoCycleToggle = document.getElementById('auto-cycle');
  const soundToggle = document.getElementById('sound-toggle');
  const themeButtons = document.querySelectorAll('.theme-button');
  const signInButton = document.getElementById('sign-in');
  const toast = document.getElementById('toast');

  progressCircle.style.strokeDasharray = circumference.toString();

  // Circular progress ring uses stroke-dashoffset to animate remaining time.
  const updateProgress = (state) => {
    const { remainingSeconds, durationSeconds } = state;
    const safeDuration = durationSeconds || 1;
    const ratio = Math.min(1, Math.max(0, remainingSeconds / safeDuration));
    const offset = circumference * (1 - ratio);
    progressCircle.style.strokeDashoffset = offset;
  };

  const updateDisplay = (state) => {
    timeOutput.textContent = formatTime(state.remainingSeconds);
    statusLabel.textContent = state.statusLabel;
    primaryButton.textContent = primaryLabel(state.status);
    updateProgress(state);
    highlightMode(state.mode);
  };

  onTimerEvent('timer:update', (event) => updateDisplay(event.detail));
  updateDisplay(getTimerState());

  primaryButton.addEventListener('click', () => {
    toggleTimer();
  });

  timerCircle.addEventListener('click', () => {
    toggleTimer();
  });
  timerCircle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTimer();
    }
  });

  resetButton.addEventListener('click', () => {
    resetTimer();
    showToast('Timer reset', toast);
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      selectMode(mode);
      highlightMode(mode);
    });
  });

  function highlightMode(mode) {
    modeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
  }

  sidebarToggle.addEventListener('click', () => openSidebar(body));
  sidebarClose.addEventListener('click', () => closeSidebar(body));
  overlay.addEventListener('click', () => closeSidebar(body));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar(body);
    }
  });

  // Sidebar tab buttons toggle Configure/Select panels.
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive.toString());
      });
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `${target}-panel`);
      });
    });
  });

  // Number pickers manage plan values without native inputs to keep layout consistent.
  pickers.forEach((picker) => {
    const field = picker.dataset.field;
    const valueElement = picker.querySelector('[data-field-value]');
    valueElement.textContent = pickerValues[field];
    picker.addEventListener('click', (event) => {
      const control = event.target.closest('.picker-control');
      if (!control) return;
      const direction = control.dataset.direction === 'up' ? 1 : -1;
      adjustPicker(field, direction);
      valueElement.textContent = pickerValues[field];
      updateSummaryText(summary);
    });
  });

  function adjustPicker(field, delta) {
    const limits = pickerLimits[field];
    const next = pickerValues[field] + delta;
    pickerValues[field] = clamp(next, limits.min, limits.max);
  }

  function updateSummaryText(node) {
    const focus = pickerValues.focusMinutes;
    const brk = pickerValues.breakMinutes;
    const cycles = pickerValues.cycles;
    const total = focus * cycles + brk * Math.max(0, cycles - 1);
    node.textContent = `${focus} / ${brk} × ${cycles} ≈ ${formatDuration(total)}`;
  }

  updateSummaryText(summary);

  applyPlanButton.addEventListener('click', () => {
    resetTimer();
    updatePlanSettings({
      focusMinutes: pickerValues.focusMinutes,
      breakMinutes: pickerValues.breakMinutes,
      cycles: pickerValues.cycles,
    });
    applyPlanSettings();
    showToast('Plan applied', toast);
  });

  savePlanButton.addEventListener('click', () => {
    showToast('Plan saved (placeholder)', toast);
  });

  const preferences = getPreferences();
  autoCycleToggle.checked = preferences.autoCycle;
  soundToggle.checked = preferences.sound;

  autoCycleToggle.addEventListener('change', () => {
    updatePreferences({ autoCycle: autoCycleToggle.checked });
  });

  soundToggle.addEventListener('change', () => {
    updatePreferences({ sound: soundToggle.checked });
  });

  const currentTheme = getTheme();
  applyTheme(body, currentTheme, themeButtons);

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      setTheme(theme);
      applyTheme(body, theme, themeButtons);
    });
  });

  signInButton.addEventListener('click', () => {
    showToast('Sign in coming soon', toast);
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function primaryLabel(status) {
  if (status === 'running') return 'Pause';
  if (status === 'paused') return 'Resume';
  return 'Start';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}

function openSidebar(body) {
  // Body class controls overlay visibility and slide-in motion.
  body.classList.add('sidebar-open');
}

function closeSidebar(body) {
  body.classList.remove('sidebar-open');
}

function showToast(message, node) {
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.classList.add('visible');
  toastTimeout = setTimeout(() => {
    node.classList.remove('visible');
  }, 2200);
}

function applyTheme(body, theme, buttons) {
  body.setAttribute('data-theme', theme);
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.theme === theme);
  });
}
