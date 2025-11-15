// state.js
// Keeps plan configuration, user preferences, and theme information decoupled from UI.

const DEFAULT_PLAN = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycles: 4,
};

const DEFAULT_PREFERENCES = {
  autoCycle: true,
  sound: true,
};

const THEME_KEY = 'pomodoro-theme';

let plan = { ...DEFAULT_PLAN };
let preferences = { ...DEFAULT_PREFERENCES };
let theme = loadTheme();

const stateEvents = new EventTarget();

function loadTheme() {
  if (typeof window === 'undefined') return 'night';
  return localStorage.getItem(THEME_KEY) || 'night';
}

function saveTheme(nextTheme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, nextTheme);
}

function calculateLongBreak(minutes) {
  // Use a simple rule: long break lasts three short breaks but never below 10 min.
  return Math.min(45, Math.max(10, minutes * 3));
}

export function getPlanSettings() {
  return { ...plan };
}

export function updatePlanSettings(nextPlan) {
  plan = {
    ...plan,
    ...nextPlan,
  };
  if (nextPlan.breakMinutes) {
    plan.longBreakMinutes = calculateLongBreak(plan.breakMinutes);
  }
  emit('plan:change', { plan: { ...plan } });
}

export function getPreferences() {
  return { ...preferences };
}

export function updatePreferences(nextPreferences) {
  preferences = { ...preferences, ...nextPreferences };
  emit('preferences:change', { preferences: { ...preferences } });
}

export function getTheme() {
  return theme;
}

export function setTheme(nextTheme) {
  // Persist chosen theme for future visits.
  theme = nextTheme;
  saveTheme(nextTheme);
  emit('theme:change', { theme: nextTheme });
}

export function onStateEvent(type, listener) {
  stateEvents.addEventListener(type, listener);
}

function emit(type, detail) {
  stateEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

export function resetState() {
  plan = { ...DEFAULT_PLAN };
  preferences = { ...DEFAULT_PREFERENCES };
  emit('plan:change', { plan: { ...plan } });
  emit('preferences:change', { preferences: { ...preferences } });
}
