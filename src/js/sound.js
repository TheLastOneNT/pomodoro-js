// sound.js
// Centralized audio management for timer modes, session starts, metronome, and countdown cues.

import { getPreferences, onStateEvent } from "./state.js";

const SOUND_PATHS = {
  focusSwitch: "sounds/focus-switch.wav",
  relaxSwitch: "sounds/relax-switch.wav",
  waitingSwitch: "sounds/waiting-switch.wav",
  pause: "sounds/pause.mp3",
  focusStart: "sounds/focus-start.wav",
  relaxStart: "sounds/relax-start.mp3",
  countdown: "sounds/countdown.wav",
  metronome: "sounds/metronome.mp3",
  relaxAmbient: "sounds/relax-ambient.mp3", // новый фоновый звук для перерыва
};

const audioBank = {
  focusSwitch: createAudio(SOUND_PATHS.focusSwitch, 0.25),
  relaxSwitch: createAudio(SOUND_PATHS.relaxSwitch, 0.25),
  waitingSwitch: createAudio(SOUND_PATHS.waitingSwitch, 0.25),
  pause: createAudio(SOUND_PATHS.pause, 0.25),
  focusStart: createAudio(SOUND_PATHS.focusStart, 0.3),
  relaxStart: createAudio(SOUND_PATHS.relaxStart, 0.25),
  countdown: createAudio(SOUND_PATHS.countdown, 0.25),
  metronome: createAudio(SOUND_PATHS.metronome, 0.3),
  relaxAmbient: createAudio(SOUND_PATHS.relaxAmbient, 0.2, true), // loop
};

let isSoundEnabled = getPreferences().sound;
let metronomeId = null;

// Keep local flag in sync with sidebar toggle; stop ambience + one-shots, но не ломаем интервал метронома.
onStateEvent("preferences:change", (event) => {
  isSoundEnabled = event.detail.preferences.sound;

  if (!isSoundEnabled) {
    audioBank.metronome.pause();
    audioBank.metronome.currentTime = 0;
    stopRelaxAmbient();
    stopAllOneShots();
  }
});

function createAudio(path, volume, loop = false) {
  const audio = new Audio(path);
  audio.preload = "auto";
  audio.volume = volume;
  audio.loop = loop;
  return audio;
}

function playClip(audio) {
  if (!isSoundEnabled || !audio) return;
  audio.currentTime = 0;
  const p = audio.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {});
  }
}

function stopAllOneShots() {
  Object.values(audioBank).forEach((audio) => {
    if (audio.loop) return;
    audio.pause();
    audio.currentTime = 0;
  });
}

/* ---------- Public API ---------- */

export function playModeSwitchSound(mode) {
  if (mode === "focus") {
    playClip(audioBank.focusSwitch);
    return;
  }
  if (mode === "relax") {
    playClip(audioBank.relaxSwitch);
    return;
  }
  if (mode === "waiting" || mode === "ready") {
    playClip(audioBank.waitingSwitch);
    return;
  }
  if (mode === "paused") {
    playClip(audioBank.pause);
  }
}

export function playSessionStartSound(mode) {
  if (mode === "focus") {
    playClip(audioBank.focusStart);
    return;
  }
  if (mode === "relax") {
    playClip(audioBank.relaxStart);
  }
}

export function playPauseSound() {
  playClip(audioBank.pause);
}

export function playCountdownSound() {
  playClip(audioBank.countdown);
}

export function stopCountdownSound() {
  const a = audioBank.countdown;
  a.pause();
  a.currentTime = 0;
}

export function startMetronome() {
  if (!isSoundEnabled) return;
  stopMetronome();
  // Fire an immediate tick so the beat is audible right away.
  playClip(audioBank.metronome);
  metronomeId = setInterval(() => playClip(audioBank.metronome), 1000);
}

export function stopMetronome() {
  if (metronomeId) {
    clearInterval(metronomeId);
    metronomeId = null;
  }
  audioBank.metronome.pause();
  audioBank.metronome.currentTime = 0;
}

// Фон для перерыва
export function startRelaxAmbient() {
  if (!isSoundEnabled) return;
  const a = audioBank.relaxAmbient;
  try {
    // не обнуляем currentTime, чтобы луп шел естественно;
    // если хочешь всегда с начала — раскомментируй строку ниже:
    // a.currentTime = 0;
    a.play();
  } catch (e) {}
}

export function stopRelaxAmbient() {
  const a = audioBank.relaxAmbient;
  a.pause();
  a.currentTime = 0;
}
