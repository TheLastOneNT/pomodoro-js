// timer.js
// Implements a single-source timer state machine for focus/relax cycles.
// States: ready → running (focus) → running (relax) → waiting/ready, with pause/resume support.

import { getPlanSettings, getPreferences } from "./state.js";

const timerEvents = new EventTarget();
let tickerId = null;

const timerState = {
  status: "ready", // ready | running | paused | waiting
  phase: "focus", // focus | relax
  remainingSeconds: 0,
  durationSeconds: 0,
  cyclesLeft: 0,
  totalCycles: 0,
  isRunning: false,
};

initializeFromPlan();

function initializeFromPlan() {
  const plan = getPlanSettings();
  timerState.status = "ready";
  timerState.phase = "focus";
  timerState.durationSeconds = plan.focusMinutes * 60;
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.cyclesLeft = plan.cycles;
  timerState.totalCycles = plan.cycles;
  timerState.isRunning = false;
}

function emit(message) {
  timerEvents.dispatchEvent(
    new CustomEvent("timer:update", {
      detail: {
        ...timerState,
        statusLabel: deriveStatusLabel(),
        primaryLabel: derivePrimaryLabel(),
        tone: deriveTone(),
        totalRemainingSeconds: calculateTotalRemaining(),
        message,
      },
    })
  );
}

function deriveStatusLabel() {
  if (timerState.status === "ready") return "Ready";
  if (timerState.status === "waiting") return "Waiting";
  if (timerState.status === "paused") return "Paused";
  return timerState.phase === "focus" ? "Focus" : "Relax";
}

function derivePrimaryLabel() {
  if (timerState.status === "running") return "Pause";
  if (timerState.status === "paused") return "Resume";
  if (timerState.status === "waiting") return "Continue";
  return "Start";
}

function deriveTone() {
  if (timerState.status === "paused") return "paused";
  if (timerState.status === "waiting") return "waiting";
  if (timerState.status === "ready") return "ready";
  return timerState.phase === "focus" ? "focus" : "relax";
}

function calculateTotalRemaining() {
  const plan = getPlanSettings();
  const focusSeconds = plan.focusMinutes * 60;
  const relaxSeconds = plan.relaxMinutes * 60;
  const cycles = Math.max(timerState.cyclesLeft, 0);

  if (timerState.status === "ready") {
    return cycles * (focusSeconds + relaxSeconds);
  }

  if (timerState.phase === "focus") {
    const remainingCycles = Math.max(cycles - 1, 0);
    return (
      timerState.remainingSeconds +
      relaxSeconds +
      remainingCycles * (focusSeconds + relaxSeconds)
    );
  }

  // Relax phase: the current focus portion already finished.
  const remainingCycles = Math.max(cycles - 1, 0);
  return (
    timerState.remainingSeconds +
    remainingCycles * (focusSeconds + relaxSeconds)
  );
}

function clearTicker() {
  if (tickerId) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

function startTicker() {
  clearTicker();
  tickerId = setInterval(handleTick, 1000);
}

function handleTick() {
  if (timerState.remainingSeconds <= 0) {
    handlePhaseCompletion();
    return;
  }

  timerState.remainingSeconds -= 1;
  emit();

  if (timerState.remainingSeconds <= 0) {
    handlePhaseCompletion();
  }
}

function handlePhaseCompletion() {
  clearTicker();
  timerState.remainingSeconds = 0;
  timerState.isRunning = false;

  if (timerState.phase === "focus") {
    startRelax();
    playChime();
    emit("Relax started");
    return;
  }

  // Relax finished = full cycle completed.
  timerState.cyclesLeft = Math.max(timerState.cyclesLeft - 1, 0);
  playChime();

  if (timerState.cyclesLeft <= 0) {
    initializeFromPlan();
    emit("Plan finished. Good job!");
    return;
  }

  const { autoCycle } = getPreferences();
  if (autoCycle) {
    startFocus(
      "Next focus started — " + timerState.cyclesLeft + " cycles left."
    );
    return;
  }

  prepareWaitingState();
  emit(
    "Cycle finished — " +
      timerState.cyclesLeft +
      " cycles left. Press Continue to start the next cycle."
  );
}

function prepareWaitingState() {
  const plan = getPlanSettings();
  timerState.status = "waiting";
  timerState.phase = "focus";
  timerState.durationSeconds = plan.focusMinutes * 60;
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.isRunning = false;
}

function startFocus(message = "Timer started") {
  const plan = getPlanSettings();
  timerState.status = "running";
  timerState.phase = "focus";
  timerState.durationSeconds = plan.focusMinutes * 60;
  timerState.remainingSeconds =
    timerState.remainingSeconds || timerState.durationSeconds;
  timerState.isRunning = true;
  startTicker();
  emit(message);
}

function startRelax() {
  const plan = getPlanSettings();
  timerState.status = "running";
  timerState.phase = "relax";
  timerState.durationSeconds = plan.relaxMinutes * 60;
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.isRunning = true;
  startTicker();
}

function pauseTimer() {
  clearTicker();
  timerState.status = "paused";
  timerState.isRunning = false;
  emit("Timer paused");
}

function resumeTimer() {
  timerState.status = "running";
  timerState.isRunning = true;
  startTicker();
  emit("Timer resumed");
}

function playChime() {
  const { sound } = getPreferences();
  if (!sound) return;

  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (error) {
    // Fail silently to keep UX smooth if audio cannot play.
  }
}

export function onTimerEvent(type, listener) {
  timerEvents.addEventListener(type, listener);
}

export function performPrimaryAction() {
  if (timerState.status === "running") {
    pauseTimer();
    return;
  }

  if (timerState.status === "paused") {
    resumeTimer();
    return;
  }

  if (timerState.status === "waiting") {
    startFocus(
      "Next focus started — " + timerState.cyclesLeft + " cycles left."
    );
    return;
  }

  startFocus("Timer started");
}

export function resetTimer() {
  clearTicker();
  initializeFromPlan();
  emit("Timer reset");
}

export function applyPlanSettings() {
  clearTicker();
  initializeFromPlan();
  emit();
}

export function getTimerState() {
  return {
    ...timerState,
    statusLabel: deriveStatusLabel(),
    primaryLabel: derivePrimaryLabel(),
    tone: deriveTone(),
    totalRemainingSeconds: calculateTotalRemaining(),
  };
}
