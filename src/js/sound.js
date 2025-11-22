// sound.js
// Centralized audio management for timer modes, session starts and countdown cues.

import { getPreferences, onStateEvent } from "./state.js";

const SOUND_PATHS = {
  focusSwitch: "sounds/focus-switch.wav",
  relaxSwitch: "sounds/relax-switch.wav",
  waitingSwitch: "sounds/waiting-switch.wav",
  pause: "sounds/pause.mp3",
  focusStart: "sounds/focus-start.wav",
  relaxStart: "sounds/relax-start.mp3",
  countdown: "sounds/countdown.wav",
  relaxAmbient: "sounds/relax-ambient.mp3",
};

const audioBank = {
  focusSwitch: createAudio(SOUND_PATHS.focusSwitch, 0.25),
  relaxSwitch: createAudio(SOUND_PATHS.relaxSwitch, 0.25),
  waitingSwitch: createAudio(SOUND_PATHS.waitingSwitch, 0.25),
  pause: createAudio(SOUND_PATHS.pause, 0.25),
  focusStart: createAudio(SOUND_PATHS.focusStart, 0.3),
  relaxStart: createAudio(SOUND_PATHS.relaxStart, 0.25),
  countdown: createAudio(SOUND_PATHS.countdown, 0.25),
  relaxAmbient: createAudio(SOUND_PATHS.relaxAmbient, 0.2, true),
};

let isSoundEnabled = getPreferences().sound;

// 🔹 новый флаг – уже "разлочили" отложенные звуки или нет
let deferredSoundsPrimed = false;

// синхронизация с переключателем звука в сайдбаре
onStateEvent("preferences:change", (event) => {
  isSoundEnabled = event.detail.preferences.sound;

  if (!isSoundEnabled) {
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

/* ---------- priming для мобилок ---------- */

// вызываем один раз из обработчика клика (через timer.js)
export function primeDeferredSounds() {
  if (deferredSoundsPrimed) return;
  deferredSoundsPrimed = true;

  const keysToPrime = ["countdown", "relaxAmbient"];

  keysToPrime.forEach((key) => {
    const audio = audioBank[key];
    if (!audio) return;

    const wasMuted = audio.muted;
    audio.muted = true; // чтобы пользователь не слышал "тычок"
    audio.currentTime = 0;

    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      }).catch(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = wasMuted;
    }
  });
}

/* ---------- Public API (без метронома) ---------- */

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

//  метроном отключен: оставляем заглушки
export function startMetronome() {}
export function stopMetronome() {}

// Фон
export function startRelaxAmbient() {
  if (!isSoundEnabled) return;
  const a = audioBank.relaxAmbient;
  try {
    a.play();
  } catch (e) {}
}

export function stopRelaxAmbient() {
  const a = audioBank.relaxAmbient;
  a.pause();
  a.currentTime = 0;
}
