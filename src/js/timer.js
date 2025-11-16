// timer.js
// Implements a single-source timer state machine for focus/relax cycles.

import { getPlanSettings, getPreferences } from "./state.js";
import {
  playCountdownSound,
  playModeSwitchSound,
  playPauseSound,
  playSessionStartSound,
  startMetronome,
  stopMetronome,
  stopCountdownSound,
  startRelaxAmbient,
  stopRelaxAmbient,
  primeDeferredSounds,
} from "./sound.js";

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

  // Теперь предупреждаем за 3 секунды, а не за 5
  if (
    timerState.status === "running" &&
    timerState.remainingSeconds > 0 &&
    timerState.remainingSeconds <= 3
  ) {
    playCountdownSound();
  }

  emit();

  if (timerState.remainingSeconds <= 0) {
    handlePhaseCompletion();
  }
}

function handlePhaseCompletion() {
  clearTicker();
  timerState.remainingSeconds = 0;
  timerState.isRunning = false;
  stopCountdownSound(); // обрубаем писк при смене фазы

  if (timerState.phase === "focus") {
    startRelax();
    emit("Relax started");
    return;
  }

  // Relax finished = full cycle completed.
  timerState.cyclesLeft = Math.max(timerState.cyclesLeft - 1, 0);

  if (timerState.cyclesLeft <= 0) {
    playModeSwitchSound("ready");
    stopRelaxAmbient();
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
  playModeSwitchSound("waiting");
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
  stopRelaxAmbient();
}

function startFocus(message = "Timer started") {
  const plan = getPlanSettings();
  timerState.status = "running";
  timerState.phase = "focus";
  timerState.durationSeconds = plan.focusMinutes * 60;
  timerState.remainingSeconds =
    timerState.remainingSeconds || timerState.durationSeconds;
  timerState.isRunning = true;

  stopRelaxAmbient();
  stopCountdownSound();

  playModeSwitchSound("focus");
  playSessionStartSound("focus");
  startMetronome();
  startTicker();
  emit(message);
}

function startRelax() {
  stopMetronome();
  const plan = getPlanSettings();
  timerState.status = "running";
  timerState.phase = "relax";
  timerState.durationSeconds = plan.relaxMinutes * 60;
  timerState.remainingSeconds = timerState.durationSeconds;
  timerState.isRunning = true;

  stopCountdownSound();
  playModeSwitchSound("relax");
  playSessionStartSound("relax");
  startRelaxAmbient();
  startTicker();
}

function pauseTimer() {
  clearTicker();
  timerState.status = "paused";
  timerState.isRunning = false;
  stopMetronome();
  stopRelaxAmbient();
  stopCountdownSound();
  playModeSwitchSound("paused");
  playPauseSound();
  emit("Timer paused");
}

function resumeTimer() {
  timerState.status = "running";
  timerState.isRunning = true;

  if (timerState.phase === "focus") {
    startMetronome();
  } else {
    startRelaxAmbient();
  }

  playSessionStartSound(timerState.phase);
  startTicker();
  emit("Timer resumed");
}

export function onTimerEvent(type, listener) {
  timerEvents.addEventListener(type, listener);
}

export function performPrimaryAction() {
  primeDeferredSounds();

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
  stopMetronome();
  stopRelaxAmbient();
  stopCountdownSound();
  initializeFromPlan();
  emit("Timer reset");
}

export function applyPlanSettings() {
  clearTicker();
  stopMetronome();
  stopRelaxAmbient();
  stopCountdownSound();
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
