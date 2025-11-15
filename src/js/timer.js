// timer.js
// Implements the timer state machine (ready → running → paused → finished) and keeps
// timing logic separate from the DOM. Auto-cycle and sound are handled here so the UI can
// remain a thin layer over the data.

import { getPlanSettings, getPreferences } from './state.js';

const MODE_LABELS = {
  focus: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

const timerEvents = new EventTarget();

// Single source of truth for the timer state machine.
// status can be "ready", "running", "paused", or "finished".
const timerState = {
  mode: 'focus',
  status: 'ready',
  statusLabel: 'Ready',
  remainingSeconds: getDuration('focus'),
  durationSeconds: getDuration('focus'),
  isRunning: false,
  completedFocusSessions: 0,
};

let intervalId = null;
let audioContext;

function getDuration(mode) {
  const plan = getPlanSettings();
  switch (mode) {
    case 'short':
      return plan.breakMinutes * 60;
    case 'long':
      return plan.longBreakMinutes * 60;
    case 'focus':
    default:
      return plan.focusMinutes * 60;
  }
}

function emitUpdate() {
  timerEvents.dispatchEvent(new CustomEvent('timer:update', { detail: { ...timerState } }));
}

function clearTicker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startTicker() {
  // Interval tick drives the countdown once per second.
  clearTicker();
  intervalId = setInterval(handleTick, 1000);
}

function handleTick() {
  if (timerState.remainingSeconds <= 0) {
    completeSession();
    return;
  }
  timerState.remainingSeconds -= 1;
  emitUpdate();
  if (timerState.remainingSeconds <= 0) {
    completeSession();
  }
}

function completeSession() {
  // Session finished: notify UI, optionally auto-cycle to the next phase.
  clearTicker();
  timerState.remainingSeconds = 0;
  timerState.status = 'finished';
  timerState.isRunning = false;
  timerState.statusLabel = 'Ready';
  emitUpdate();
  playChime();
  const nextMode = resolveNextMode();
  setMode(nextMode);
  const { autoCycle } = getPreferences();
  if (autoCycle) {
    startTimer();
  }
}

function resolveNextMode() {
  // Focus sessions count toward the cycle limit before a long break.
  if (timerState.mode === 'focus') {
    timerState.completedFocusSessions += 1;
    const plan = getPlanSettings();
    if (timerState.completedFocusSessions >= plan.cycles) {
      timerState.completedFocusSessions = 0;
      return 'long';
    }
    return 'short';
  }
  if (timerState.mode === 'short' || timerState.mode === 'long') {
    return 'focus';
  }
  return 'focus';
}

function playChime() {
  // Lightweight oscillator beep to avoid bundling external assets.
  const { sound } = getPreferences();
  if (!sound) return;
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = audioContext || new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    // Ignore audio errors to keep the timer resilient.
  }
}

function setMode(mode) {
  // Reset timer to the duration of the selected mode and return to Ready.
  timerState.mode = mode;
  timerState.durationSeconds = getDuration(mode);
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.status = 'ready';
  timerState.statusLabel = 'Ready';
  timerState.isRunning = false;
  clearTicker();
  emitUpdate();
}

function startTimer() {
  // Starting from ready or finished always refreshes the remaining time.
  if (!timerState.mode) {
    setMode('focus');
  }
  timerState.status = 'running';
  timerState.statusLabel = MODE_LABELS[timerState.mode];
  timerState.isRunning = true;
  if (timerState.remainingSeconds <= 0 || timerState.remainingSeconds > timerState.durationSeconds) {
    timerState.remainingSeconds = timerState.durationSeconds;
  }
  startTicker();
  emitUpdate();
}

function pauseTimer() {
  clearTicker();
  timerState.isRunning = false;
  timerState.status = 'paused';
  timerState.statusLabel = 'Paused';
  emitUpdate();
}

export function toggleTimer() {
  if (timerState.status === 'running') {
    pauseTimer();
    return;
  }
  startTimer();
}

export function resetTimer() {
  timerState.completedFocusSessions = 0;
  setMode(timerState.mode || 'focus');
}

export function selectMode(mode) {
  if (mode === 'long') {
    timerState.completedFocusSessions = 0;
  }
  setMode(mode);
}

export function applyPlanSettings() {
  // Called when the user confirms new plan values via the sidebar picker.
  timerState.durationSeconds = getDuration(timerState.mode);
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.status = 'ready';
  timerState.statusLabel = 'Ready';
  timerState.isRunning = false;
  clearTicker();
  emitUpdate();
}

export function getTimerState() {
  return { ...timerState };
}

export function onTimerEvent(type, listener) {
  timerEvents.addEventListener(type, listener);
}
