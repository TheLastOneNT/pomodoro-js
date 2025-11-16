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
};

const audioBank = {
  focusSwitch: createAudio(SOUND_PATHS.focusSwitch, 0.35),
  relaxSwitch: createAudio(SOUND_PATHS.relaxSwitch, 0.35),
  waitingSwitch: createAudio(SOUND_PATHS.waitingSwitch, 0.35),
  pause: createAudio(SOUND_PATHS.pause, 0.35),
  focusStart: createAudio(SOUND_PATHS.focusStart, 0.4),
  relaxStart: createAudio(SOUND_PATHS.relaxStart, 0.35),
  countdown: createAudio(SOUND_PATHS.countdown, 0.45),
  metronome: createAudio(SOUND_PATHS.metronome, 0.3),
};

let isSoundEnabled = getPreferences().sound;
let metronomeId = null;

// Keep local flag in sync with sidebar toggle; stop metronome immediately when muted.
onStateEvent("preferences:change", (event) => {
  isSoundEnabled = event.detail.preferences.sound;
  if (!isSoundEnabled) {
    stopMetronome();
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
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (error) {
    // Autoplay restrictions or missing assets should not break the app.
  }
}

function stopAllOneShots() {
  Object.values(audioBank).forEach((audio) => {
    if (audio.loop) return;
    audio.pause();
    audio.currentTime = 0;
  });
}

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
