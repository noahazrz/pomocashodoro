/* ==========================================================================
   Pomocashodoro — Focus Timer (Hybrid Local + Firebase Sync)
   ========================================================================== */

// ---------------- State & Defaults ----------------
let currentUser = null;
let currentLanguage = 'es';

let settings = {
  pomodoro: 25,
  short: 5,
  long: 15,
  rounds: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  alarmSound: 'bell',
  numberFont: 'sans',
  themeKey: 'forest',
  customColors: null,
  language: 'es'
};

let tasks = [];
let sessions = [];
let activeTaskId = null;
let accessDates = [];

let mode = 'pomodoro';
let roundCurrent = 1;
let isRunning = false;
let tickHandle = null;
let endTimestamp = null;
let secondsLeft = settings.pomodoro * 60;

// Per-mode state preserves time so switching tabs/modes does not wipe progress
let modeState = {
  pomodoro: { secondsLeft: 25 * 60, initialSeconds: 25 * 60 },
  short: { secondsLeft: 5 * 60, initialSeconds: 5 * 60 },
  long: { secondsLeft: 15 * 60, initialSeconds: 15 * 60 }
};

// AudioContext singleton to avoid browser autoplay restrictions
let audioCtx = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------- Translations (i18n) ----------------
const I18N = {
  es: {
    timer: "Temporizador",
    report: "Reporte",
    signInWithGoogle: "Iniciar sesión con Google",
    logOut: "Cerrar sesión",
    settings: "Configuración",
    changeTheme: "Cambiar tema de color",
    pomodoro: "Pomodoro",
    shortBreak: "Descanso corto",
    longBreak: "Descanso largo",
    start: "INICIAR",
    pause: "PAUSAR",
    reset: "REINICIAR",
    resetAndLog: "Reiniciar tiempo y registrar al reporte",
    noTaskSelected: "Ninguna tarea seleccionada",
    shortBreakMsg: "Descanso corto — tómate un respiro",
    longBreakMsg: "Descanso largo — descansa bien",
    timeForBreak: "Momento de un descanso",
    roundOf: "Ronda {cur} de {total}",
    tasks: "Tareas",
    addTask: "Añadir tarea",
    whatWorkingOn: "¿En qué estás trabajando?",
    estPomodoros: "Pomodoros est.",
    cancel: "Cancelar",
    save: "Guardar",
    noTasksYet: "No tienes tareas pendientes. ¡Añade una para empezar!",
    allTasksDone: "¡Has terminado todas tus tareas de hoy! 🎉",
    clearFinishedTasks: "Limpiar tareas terminadas",
    hoursFocused: "horas de enfoque",
    daysAccessed: "días de acceso",
    dayStreak: "días de racha",
    focusLast7Days: "Enfoque, últimos 7 días",
    recentSessions: "Sesiones recientes",
    date: "Fecha",
    task: "Tarea",
    duration: "Duración",
    noSessionsYet: "Aún no hay sesiones registradas — completa o reinicia un pomodoro para verlo aquí.",
    untitledTask: "Tarea sin título",
    saveChanges: "Guardar cambios",
    settingsSaved: "Configuración guardada",
    themeApplied: "Tema aplicado: {name}",
    syncedGoogle: "Sincronizado con Google",
    signInFailed: "Error al iniciar sesión: ",
    firebaseMissing: "Configuración de Firebase no encontrada en firebase-config.js",
    sessionResetLogged: "Temporizador reiniciado. Se guardaron {min} min en el reporte.",
    timerReset: "Temporizador reiniciado.",
    pomodoroFinished: "¡Pomodoro terminado! Tómate un descanso.",
    breakFinished: "¡Descanso terminado! Hora de concentrarse.",
    dayLetters: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    minShort: "min",
    resetColorsConfirm: "Colores restablecidos a predeterminados.",
    markDone: "Marcar como hecha",
    deleteTask: "Eliminar tarea",
    // Settings modal strings
    timerMinutes: "Temporizador (minutos)",
    rounds: "Rondas",
    longBreakAfter: "Descanso largo tras",
    pomodorosUnit: "pomodoros",
    autoStart: "Inicio automático",
    autoStartBreaks: "Iniciar descansos automáticamente",
    autoStartPomodoros: "Iniciar pomodoros automáticamente",
    alarmSound: "Sonido de alarma",
    alarmBell: "Campana",
    alarmDigital: "Digital",
    alarmSilent: "Silencioso",
    numberFont: "Tipografía de los números",
    fontSans: "Arial Black (Predeterminado)",
    fontMono: "Espaciada / Mono (Space Mono)",
    fontSerif: "Clásica / Fraunces (Serif)",
    themeAndColors: "🎨 Tema y Colores",
    language: "Idioma",
    langSpanish: "Español (Predeterminado)",
    langEnglish: "English",
    customizeColors: "Personalizar colores exactos",
    colorBg: "Fondo",
    colorCard: "Tarjetas",
    colorAccent: "Acento / Botón",
    colorText: "Texto",
    resetColors: "Restablecer colores por defecto",
    closeSettings: "Cerrar configuración"
  },
  en: {
    timer: "Timer",
    report: "Report",
    signInWithGoogle: "Sign in with Google",
    logOut: "Log out",
    settings: "Settings",
    changeTheme: "Change color theme",
    pomodoro: "Pomodoro",
    shortBreak: "Short Break",
    longBreak: "Long Break",
    start: "START",
    pause: "PAUSE",
    reset: "RESET",
    resetAndLog: "Reset timer and log to report",
    noTaskSelected: "No task selected",
    shortBreakMsg: "Short break — step away for a bit",
    longBreakMsg: "Long break — rest up",
    timeForBreak: "Time for a break",
    roundOf: "Round {cur} of {total}",
    tasks: "Tasks",
    addTask: "Add Task",
    whatWorkingOn: "What are you working on?",
    estPomodoros: "Est. pomodoros",
    cancel: "Cancel",
    save: "Save",
    noTasksYet: "No pending tasks. Add one to start!",
    allTasksDone: "You've finished all your tasks for today 🎉",
    clearFinishedTasks: "Clear finished tasks",
    hoursFocused: "hours focused",
    daysAccessed: "days accessed",
    dayStreak: "day streak",
    focusLast7Days: "Focus, last 7 days",
    recentSessions: "Recent sessions",
    date: "Date",
    task: "Task",
    duration: "Duration",
    noSessionsYet: "No sessions logged yet — finish or reset a pomodoro to see it here.",
    untitledTask: "Untitled task",
    saveChanges: "Save changes",
    settingsSaved: "Settings saved",
    themeApplied: "Theme applied: {name}",
    syncedGoogle: "Synced with Google account",
    signInFailed: "Sign-in failed: ",
    firebaseMissing: "Firebase configuration missing in firebase-config.js",
    sessionResetLogged: "Timer reset. {min} min logged to report.",
    timerReset: "Timer reset.",
    pomodoroFinished: "Pomodoro finished! Take a break.",
    breakFinished: "Break finished! Time to focus.",
    dayLetters: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    minShort: "min",
    resetColorsConfirm: "Colors reset to defaults.",
    markDone: "Mark as done",
    deleteTask: "Delete task",
    // Settings modal strings
    timerMinutes: "Timer (minutes)",
    rounds: "Rounds",
    longBreakAfter: "Long break after",
    pomodorosUnit: "pomodoros",
    autoStart: "Auto start",
    autoStartBreaks: "Auto-start breaks",
    autoStartPomodoros: "Auto-start pomodoros",
    alarmSound: "Alarm sound",
    alarmBell: "Bell",
    alarmDigital: "Digital",
    alarmSilent: "Silent",
    numberFont: "Number font",
    fontSans: "Arial Black (Default)",
    fontMono: "Monospaced (Space Mono)",
    fontSerif: "Classic / Fraunces (Serif)",
    themeAndColors: "🎨 Theme & Colors",
    language: "Language",
    langSpanish: "Español",
    langEnglish: "English (Default)",
    customizeColors: "Customize exact colors",
    colorBg: "Background",
    colorCard: "Cards",
    colorAccent: "Accent / Button",
    colorText: "Text",
    resetColors: "Reset colors to defaults",
    closeSettings: "Close settings"
  }
};

function tr(key, params = {}) {
  const dict = I18N[currentLanguage] || I18N.es;
  let text = dict[key] || I18N.es[key] || key;
  Object.keys(params).forEach(k => {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
  });
  return text;
}

// ---------------- Themes Configuration ----------------
const THEMES = {
  forest: {
    name: "Verde Bosque",
    bg: "#12211c",
    card: "#17281f",
    border1: "#1f342a",
    border2: "#2b4638",
    text: "#f2ede1",
    textDim: "#c9c2b2",
    accent: "#e8543c",
    accentDeep: "#c23f2b",
    leaf: "#7a9a6e"
  },
  ocean: {
    name: "Azul Océano",
    bg: "#0b1329",
    card: "#131e3a",
    border1: "#1d2c54",
    border2: "#2a3f75",
    text: "#f0f4fc",
    textDim: "#9bb0db",
    accent: "#0284c7",
    accentDeep: "#0369a1",
    leaf: "#38bdf8"
  },
  burgundy: {
    name: "Borgoña Vino",
    bg: "#1c0d12",
    card: "#28141b",
    border1: "#3b1c28",
    border2: "#522538",
    text: "#fdf2f4",
    textDim: "#d4a8b5",
    accent: "#e11d48",
    accentDeep: "#be123c",
    leaf: "#fb7185"
  },
  purple: {
    name: "Púrpura Galáctico",
    bg: "#130d24",
    card: "#1e1438",
    border1: "#2d1e54",
    border2: "#422c7a",
    text: "#f7f4ff",
    textDim: "#c2b3e8",
    accent: "#9333ea",
    accentDeep: "#7e22ce",
    leaf: "#c084fc"
  },
  dark: {
    name: "Carbón OLED",
    bg: "#121214",
    card: "#1a1a1f",
    border1: "#26262e",
    border2: "#383845",
    text: "#f4f4f5",
    textDim: "#a1a1aa",
    accent: "#10b981",
    accentDeep: "#059669",
    leaf: "#34d399"
  },
  sunset: {
    name: "Café Atardecer",
    bg: "#1c1511",
    card: "#291e18",
    border1: "#3b2c23",
    border2: "#523d32",
    text: "#fcf6ee",
    textDim: "#d1bca8",
    accent: "#ea580c",
    accentDeep: "#c2410c",
    leaf: "#f59e0b"
  }
};

// ---------------- Initialize ----------------
loadLocalData();
initAudioContext();
applyLanguage(settings.language || 'es');
applyTheme(settings.themeKey || 'forest', settings.customColors);
applyNumberFont(settings.numberFont || 'sans');
applySettingsToForm();
renderTasks();
renderClock();
updateRoundDisplay();
renderReportStats();
checkAndRestoreActiveTimer();

// ---------------- Local Storage Management ----------------
function todayKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadLocalData() {
  try {
    const s = JSON.parse(localStorage.getItem('pomocashodoro_settings'));
    if (s && typeof s === 'object') {
      settings = Object.assign(settings, s);
    }
    currentLanguage = settings.language || 'es';

    const tData = JSON.parse(localStorage.getItem('pomocashodoro_tasks'));
    if (Array.isArray(tData)) tasks = tData;

    const sesData = JSON.parse(localStorage.getItem('pomocashodoro_sessions'));
    if (Array.isArray(sesData)) sessions = sesData;

    const accData = JSON.parse(localStorage.getItem('pomocashodoro_accessDates'));
    if (Array.isArray(accData)) accessDates = accData;
    const tKey = todayKey();
    if (!accessDates.includes(tKey)) {
      accessDates.push(tKey);
      localStorage.setItem('pomocashodoro_accessDates', JSON.stringify(accessDates));
    }

    // Restore activeTaskId
    const savedActiveTask = localStorage.getItem('pomocashodoro_activeTaskId');
    if (savedActiveTask) activeTaskId = savedActiveTask;

    // Initialize mode state from loaded settings
    modeState = {
      pomodoro: { secondsLeft: settings.pomodoro * 60, initialSeconds: settings.pomodoro * 60 },
      short: { secondsLeft: settings.short * 60, initialSeconds: settings.short * 60 },
      long: { secondsLeft: settings.long * 60, initialSeconds: settings.long * 60 }
    };
    secondsLeft = modeState[mode].secondsLeft;

  } catch (e) {
    console.warn('Error loading localStorage:', e);
  }
}

// ---------------- Theme Management ----------------
function applyTheme(themeKey, custom = null) {
  const root = document.documentElement;
  let colors;

  if (custom) {
    colors = {
      bg: custom.bg,
      card: custom.card,
      border1: adjustHexColor(custom.card, 15),
      border2: adjustHexColor(custom.card, 25),
      text: custom.text,
      textDim: adjustHexColor(custom.text, -25),
      accent: custom.accent,
      accentDeep: adjustHexColor(custom.accent, -18),
      leaf: adjustHexColor(custom.accent, 20)
    };
    $$('.theme-pill').forEach(b => b.classList.remove('is-active'));
  } else {
    const theme = THEMES[themeKey] || THEMES.forest;
    colors = theme;
    $$('.theme-pill').forEach(b => b.classList.toggle('is-active', b.dataset.themeKey === themeKey));
  }

  root.style.setProperty('--green-950', colors.bg);
  root.style.setProperty('--green-900', colors.card);
  root.style.setProperty('--green-800', colors.border1);
  root.style.setProperty('--green-700', colors.border2);
  root.style.setProperty('--bone', colors.text);
  root.style.setProperty('--bone-dim', colors.textDim);
  root.style.setProperty('--tomato', colors.accent);
  root.style.setProperty('--tomato-deep', colors.accentDeep);
  root.style.setProperty('--leaf', colors.leaf);
  root.style.setProperty('--focus-ring', colors.text);

  // Update pickers
  if ($('#picker-bg')) $('#picker-bg').value = rgbToHex(colors.bg);
  if ($('#picker-card')) $('#picker-card').value = rgbToHex(colors.card);
  if ($('#picker-accent')) $('#picker-accent').value = rgbToHex(colors.accent);
  if ($('#picker-text')) $('#picker-text').value = rgbToHex(colors.text);
}

function adjustHexColor(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function rgbToHex(color) {
  if (color && color.startsWith('#')) return color;
  return '#12211c';
}

function applyNumberFont(fontType) {
  document.body.dataset.numberFont = fontType || 'sans';
  if ($('#set-number-font')) $('#set-number-font').value = fontType || 'sans';
}

// ---------------- i18n Language Management ----------------
function applyLanguage(lang) {
  currentLanguage = lang || 'es';
  document.documentElement.lang = currentLanguage;

  // Top bar
  $('#nav-timer-btn').textContent = tr('timer');
  $('#nav-report-btn').textContent = tr('report');
  $('#google-login-text').textContent = tr('signInWithGoogle');
  $('#logout-btn').textContent = tr('logOut');
  $('#theme-quick-btn').title = tr('changeTheme');
  $('#theme-quick-btn').setAttribute('aria-label', tr('changeTheme'));
  $('#settings-btn').title = tr('settings');
  $('#settings-btn').setAttribute('aria-label', tr('settings'));

  // Mode buttons
  $('#mode-pomodoro-btn').textContent = tr('pomodoro');
  $('#mode-short-btn').textContent = tr('shortBreak');
  $('#mode-long-btn').textContent = tr('longBreak');

  // Timer controls
  $('#start-btn').textContent = isRunning ? tr('pause') : tr('start');
  $('#reset-btn-text').textContent = tr('reset');
  $('#reset-btn').title = tr('resetAndLog');
  $('#reset-btn').setAttribute('aria-label', tr('reset'));

  updateTaskLabel();
  updateRoundDisplay();

  // Tasks panel
  $('#tasks-title').textContent = tr('tasks');
  $('#add-task-text').textContent = tr('addTask');
  $('#task-title').placeholder = tr('whatWorkingOn');
  $('#task-est-label').textContent = tr('estPomodoros');
  $('#task-cancel-btn').textContent = tr('cancel');
  $('#task-save-btn').textContent = tr('save');
  $('#clear-tasks-btn').textContent = tr('clearFinishedTasks');

  // Report view
  $('#label-hours-focused').textContent = tr('hoursFocused');
  $('#label-days-accessed').textContent = tr('daysAccessed');
  $('#label-day-streak').textContent = tr('dayStreak');
  $('#chart-title').textContent = tr('focusLast7Days');
  $('#log-title').textContent = tr('recentSessions');
  $('#th-date').textContent = tr('date');
  $('#th-task').textContent = tr('task');
  $('#th-duration').textContent = tr('duration');
  $('#log-empty').textContent = tr('noSessionsYet');

  // Settings modal — fully translated (BUG FIX: was hardcoded in Spanish)
  $('#settings-heading').textContent = tr('settings');
  $('#settings-close-btn').setAttribute('aria-label', tr('closeSettings'));
  $('#section-timer-label').textContent = tr('timerMinutes');
  $('#set-pomodoro-label').textContent = tr('pomodoro');
  $('#set-short-label').textContent = tr('shortBreak');
  $('#set-long-label').textContent = tr('longBreak');
  $('#section-rounds-label').textContent = tr('rounds');
  $('#set-rounds-desc').textContent = tr('longBreakAfter');
  $('#set-rounds-unit').textContent = tr('pomodorosUnit');
  $('#section-autostart-label').textContent = tr('autoStart');
  $('#set-autostart-breaks-label').textContent = tr('autoStartBreaks');
  $('#set-autostart-pomodoros-label').textContent = tr('autoStartPomodoros');
  $('#section-alarm-label').textContent = tr('alarmSound');
  $('#section-font-label').textContent = tr('numberFont');
  $('#section-theme-label').textContent = tr('themeAndColors');
  $('#section-lang-label').textContent = tr('language');
  $('#settings-save-btn').textContent = tr('saveChanges');

  // Alarm sound select options
  const alarmSelect = $('#set-alarm-sound');
  if (alarmSelect) {
    alarmSelect.options[0].textContent = tr('alarmBell');
    alarmSelect.options[1].textContent = tr('alarmDigital');
    alarmSelect.options[2].textContent = tr('alarmSilent');
  }

  // Font select options
  const fontSelect = $('#set-number-font');
  if (fontSelect) {
    fontSelect.options[0].textContent = tr('fontSans');
    fontSelect.options[1].textContent = tr('fontMono');
    fontSelect.options[2].textContent = tr('fontSerif');
  }

  // Language select options
  const langSelect = $('#set-language');
  if (langSelect) {
    langSelect.options[0].textContent = tr('langSpanish');
    langSelect.options[1].textContent = tr('langEnglish');
    langSelect.value = currentLanguage;
  }

  // Custom colors section
  $('#custom-colors-summary').textContent = tr('customizeColors');
  $('#lbl-color-bg').textContent = tr('colorBg');
  $('#lbl-color-card').textContent = tr('colorCard');
  $('#lbl-color-accent').textContent = tr('colorAccent');
  $('#lbl-color-text').textContent = tr('colorText');
  $('#reset-colors-btn').textContent = tr('resetColors');

  renderTasks();
  if (!$('#view-report').hidden) {
    renderReport();
  }
}

// ---------------- Audio & Notification Initialization ----------------
function initAudioContext() {
  const startAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    window.removeEventListener('click', startAudio);
    window.removeEventListener('keydown', startAudio);
  };
  window.addEventListener('click', startAudio);
  window.addEventListener('keydown', startAudio);
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ---------------- Firebase Auth Binding ----------------
function checkFirebase() {
  return typeof firebase !== 'undefined' && typeof window.auth !== 'undefined';
}

$('#google-login-btn').addEventListener('click', async () => {
  if (!checkFirebase()) {
    showToast(tr('firebaseMissing'));
    return;
  }
  
  try {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    await window.auth.signInWithPopup(googleProvider);
  } catch (err) {
    showToast(tr('signInFailed') + (err.message || err));
  }
});

// BUG FIX: Always bind logout button, guard with checkFirebase() inside handler
$('#logout-btn').addEventListener('click', async () => {
  if (!checkFirebase()) return;
  try {
    await window.auth.signOut();
  } catch (err) {
    console.warn('Logout error:', err);
  }
});

if (checkFirebase()) {
  window.auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      $('#google-login-btn').hidden = true;
      $('#user-chip').hidden = false;
      $('#user-name').textContent = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
      await syncWithFirestore();
      showToast(tr('syncedGoogle'));
    } else {
      currentUser = null;
      $('#google-login-btn').hidden = false;
      $('#user-chip').hidden = true;
    }
  });
}

async function syncWithFirestore() {
  if (!currentUser || typeof db === 'undefined') return;

  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const snap = await userRef.get();

    if (snap.exists) {
      const data = snap.data();
      if (data.settings) {
        settings = Object.assign(settings, data.settings);
        applyTheme(settings.themeKey, settings.customColors);
        applyNumberFont(settings.numberFont);
        if (settings.language) applyLanguage(settings.language);
      }
      if (Array.isArray(data.accessDates)) {
        accessDates = Array.from(new Set([...accessDates, ...data.accessDates]));
      }
      applySettingsToForm();
    }

    if (!accessDates.includes(todayKey())) accessDates.push(todayKey());
    await userRef.set({ settings, accessDates }, { merge: true });

    // Load cloud tasks
    const taskSnap = await userRef.collection('tasks').orderBy('createdAt', 'asc').get();
    if (!taskSnap.empty) {
      tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTasks();
    }

    // Load cloud sessions
    const sessionSnap = await userRef.collection('sessions').orderBy('completedAt', 'desc').limit(50).get();
    if (!sessionSnap.empty) {
      sessions = sessionSnap.docs.map(d => d.data());
      renderReport();
    }

    renderReportStats();
  } catch (e) {
    console.warn('Firestore sync error:', e);
  }
}

// ==========================================================================
// SETTINGS MODAL & THEMES
// ==========================================================================

function openSettings() {
  applySettingsToForm();
  $('#settings-modal').hidden = false;
}

function closeSettings() {
  $('#settings-modal').hidden = true;
}

$('#settings-btn').addEventListener('click', openSettings);
$('#settings-close-btn').addEventListener('click', closeSettings);

$('#settings-modal').addEventListener('click', (e) => {
  if (e.target === $('#settings-modal')) closeSettings();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#settings-modal').hidden) {
    closeSettings();
  }
});

function applySettingsToForm() {
  $('#set-pomodoro').value = settings.pomodoro;
  $('#set-short').value = settings.short;
  $('#set-long').value = settings.long;
  $('#set-rounds').value = settings.rounds;
  $('#set-autostart-breaks').checked = !!settings.autoStartBreaks;
  $('#set-autostart-pomodoros').checked = !!settings.autoStartPomodoros;
  $('#set-alarm-sound').value = settings.alarmSound || 'bell';
  $('#set-number-font').value = settings.numberFont || 'sans';
  $('#set-language').value = currentLanguage;
  $('#round-total').textContent = settings.rounds;
}

// Theme presets buttons
$$('.theme-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.themeKey;
    settings.themeKey = key;
    settings.customColors = null;
    applyTheme(key, null);
    saveSettingsLocally();
    showToast(tr('themeApplied', { name: THEMES[key].name }));
  });
});

// Custom color pickers
function onCustomColorChange() {
  const custom = {
    bg: $('#picker-bg').value,
    card: $('#picker-card').value,
    accent: $('#picker-accent').value,
    text: $('#picker-text').value
  };
  settings.themeKey = 'custom';
  settings.customColors = custom;
  applyTheme('custom', custom);
  saveSettingsLocally();
}

$('#picker-bg').addEventListener('input', onCustomColorChange);
$('#picker-card').addEventListener('input', onCustomColorChange);
$('#picker-accent').addEventListener('input', onCustomColorChange);
$('#picker-text').addEventListener('input', onCustomColorChange);

$('#reset-colors-btn').addEventListener('click', () => {
  settings.themeKey = 'forest';
  settings.customColors = null;
  applyTheme('forest', null);
  saveSettingsLocally();
  showToast(tr('resetColorsConfirm'));
});

// Quick theme switch button in header (cycles through presets)
const themeKeys = Object.keys(THEMES);
$('#theme-quick-btn').addEventListener('click', () => {
  let currentIndex = themeKeys.indexOf(settings.themeKey);
  if (currentIndex === -1) currentIndex = 0;
  const nextKey = themeKeys[(currentIndex + 1) % themeKeys.length];
  settings.themeKey = nextKey;
  settings.customColors = null;
  applyTheme(nextKey, null);
  saveSettingsLocally();
  showToast(tr('themeApplied', { name: THEMES[nextKey].name }));
});

// Save Settings from modal
$('#settings-save-btn').addEventListener('click', async () => {
  const prevPomo = settings.pomodoro;
  const prevShort = settings.short;
  const prevLong = settings.long;

  settings.pomodoro = clampInt($('#set-pomodoro').value, 1, 90, 25);
  settings.short = clampInt($('#set-short').value, 1, 60, 5);
  settings.long = clampInt($('#set-long').value, 1, 90, 15);
  settings.rounds = clampInt($('#set-rounds').value, 2, 12, 4);
  settings.autoStartBreaks = $('#set-autostart-breaks').checked;
  settings.autoStartPomodoros = $('#set-autostart-pomodoros').checked;
  settings.alarmSound = $('#set-alarm-sound').value;
  settings.numberFont = $('#set-number-font').value;
  settings.language = $('#set-language').value;

  applyNumberFont(settings.numberFont);
  applyLanguage(settings.language);

  // Update mode durations if changed and timer is not currently running in that mode
  if (settings.pomodoro !== prevPomo && (!isRunning || mode !== 'pomodoro')) {
    modeState.pomodoro.initialSeconds = settings.pomodoro * 60;
    modeState.pomodoro.secondsLeft = settings.pomodoro * 60;
  }
  if (settings.short !== prevShort && (!isRunning || mode !== 'short')) {
    modeState.short.initialSeconds = settings.short * 60;
    modeState.short.secondsLeft = settings.short * 60;
  }
  if (settings.long !== prevLong && (!isRunning || mode !== 'long')) {
    modeState.long.initialSeconds = settings.long * 60;
    modeState.long.secondsLeft = settings.long * 60;
  }

  if (!isRunning) {
    secondsLeft = modeState[mode].secondsLeft;
    renderClock();
  }

  saveSettingsLocally();
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).set({ settings }, { merge: true });
  }

  $('#round-total').textContent = settings.rounds;
  closeSettings();
  showToast(tr('settingsSaved'));
});

function saveSettingsLocally() {
  localStorage.setItem('pomocashodoro_settings', JSON.stringify(settings));
}

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ==========================================================================
// NAVIGATION (Tabs: Timer <-> Report)
// ==========================================================================

$$('.navlink').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.navlink').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const view = btn.dataset.view;
    $('#view-timer').hidden = view !== 'timer';
    $('#view-report').hidden = view !== 'report';
    if (view === 'report') renderReport();
    // BUG FIX: switching views (Timer <-> Report) no longer touches the timer state
  });
});

// ==========================================================================
// TIMER & TABS (Mode Tabs: Pomodoro <-> Short <-> Long)
// ==========================================================================

function getModeDurationSeconds(m) {
  const min = m === 'pomodoro' ? settings.pomodoro : (m === 'short' ? settings.short : settings.long);
  return min * 60;
}

// Mode tabs event listener - preserves progress!
$$('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetMode = btn.dataset.mode;
    if (mode === targetMode) return;
    setMode(targetMode);
  });
});

function setMode(newMode) {
  // 1. Save current active mode remaining time
  if (modeState[mode]) {
    modeState[mode].secondsLeft = secondsLeft;
  }

  // If timer was running, pause it gracefully without resetting elapsed time
  if (isRunning) {
    stopTimer();
  }

  // 2. Switch mode
  mode = newMode;

  // 3. Restore target mode remaining time
  if (!modeState[mode]) {
    const dur = getModeDurationSeconds(mode);
    modeState[mode] = { secondsLeft: dur, initialSeconds: dur };
  }
  secondsLeft = modeState[mode].secondsLeft;

  // 4. Update UI
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  $('#timer-card').classList.toggle('is-break', mode !== 'pomodoro');
  updateTaskLabel();
  renderClock();
  saveTimerState();
}

function updateTaskLabel() {
  const el = $('#timer-task-label');
  if (mode === 'pomodoro') {
    el.textContent = activeTaskLabel() || tr('noTaskSelected');
  } else if (mode === 'short') {
    el.textContent = tr('shortBreakMsg');
  } else {
    el.textContent = tr('longBreakMsg');
  }
}

function updateRoundDisplay() {
  $('#round-current').textContent = Math.min(roundCurrent, settings.rounds);
  $('#round-total').textContent = settings.rounds;
}

function activeTaskLabel() {
  const item = tasks.find(tk => tk.id === activeTaskId);
  return item ? item.title : '';
}

// START / PAUSE Button
$('#start-btn').addEventListener('click', () => {
  requestNotificationPermission();
  if (isRunning) {
    stopTimer();
  } else {
    startTimer();
  }
});

// REINICIAR (Reset) Button next to Start
$('#reset-btn').addEventListener('click', () => {
  const initial = modeState[mode].initialSeconds || getModeDurationSeconds(mode);
  const elapsedSec = Math.max(0, initial - secondsLeft);

  // If at least 15 seconds elapsed, send elapsed time to the report
  if (elapsedSec >= 15) {
    const elapsedMinutes = elapsedSec < 60 ? 1 : Math.round(elapsedSec / 60);
    logSession(mode, elapsedMinutes);
    showToast(tr('sessionResetLogged', { min: elapsedMinutes }));
  } else {
    showToast(tr('timerReset'));
  }

  // Stop running and reset clock to full duration
  stopTimer();
  secondsLeft = getModeDurationSeconds(mode);
  modeState[mode].secondsLeft = secondsLeft;
  modeState[mode].initialSeconds = secondsLeft;
  renderClock();
  saveTimerState();
  // BUG FIX: always refresh the report view so the new session appears immediately
  renderReport();
});

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  endTimestamp = Date.now() + secondsLeft * 1000;
  $('#start-btn').textContent = tr('pause');
  $('#start-btn').classList.add('is-running');
  renderClock();
  saveTimerState();
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
}

function stopTimer() {
  isRunning = false;
  clearInterval(tickHandle);
  endTimestamp = null;
  if (modeState[mode]) {
    modeState[mode].secondsLeft = secondsLeft;
  }
  $('#start-btn').textContent = tr('start');
  $('#start-btn').classList.remove('is-running');
  renderClock();
  saveTimerState();
}

function tick() {
  if (!isRunning || !endTimestamp) return;
  const remainingMs = endTimestamp - Date.now();
  secondsLeft = Math.max(0, Math.round(remainingMs / 1000));
  if (modeState[mode]) {
    modeState[mode].secondsLeft = secondsLeft;
  }
  renderClock();

  if (remainingMs <= 0) {
    clearInterval(tickHandle);
    isRunning = false;
    endTimestamp = null;
    $('#start-btn').textContent = tr('start');
    $('#start-btn').classList.remove('is-running');
    saveTimerState();
    onIntervalComplete();
  }
}

function renderClock() {
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = Math.floor(secondsLeft % 60).toString().padStart(2, '0');
  $('#timer-clock').textContent = `${m}:${s}`;
  document.title = isRunning ? `${m}:${s} — Pomocashodoro` : 'Pomocashodoro';
}

function onIntervalComplete() {
  playAlarm();
  notifyDesktop();

  const fullDuration = getModeDurationSeconds(mode) / 60;

  if (mode === 'pomodoro') {
    logSession('pomodoro', fullDuration);
    if (activeTaskId) incrementTaskDone(activeTaskId);

    const nextIsLong = roundCurrent >= settings.rounds;
    if (nextIsLong) {
      roundCurrent = 1;
    } else {
      roundCurrent++;
    }
    updateRoundDisplay();

    setModeSilently(nextIsLong ? 'long' : 'short');
    if (settings.autoStartBreaks) startTimer();

  } else {
    logSession(mode, fullDuration);
    setModeSilently('pomodoro');
    if (settings.autoStartPomodoros) startTimer();
  }
}

function setModeSilently(newMode) {
  mode = newMode;
  const dur = getModeDurationSeconds(mode);
  modeState[mode] = { secondsLeft: dur, initialSeconds: dur };
  secondsLeft = dur;

  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  $('#timer-card').classList.toggle('is-break', mode !== 'pomodoro');
  updateTaskLabel();
  renderClock();
  saveTimerState();
}

function playAlarm() {
  if (settings.alarmSound === 'none') return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const freqs = settings.alarmSound === 'digital' ? [880, 880, 880] : [660, 880];
    let tTime = audioCtx.currentTime;
    freqs.forEach((f) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = settings.alarmSound === 'digital' ? 'square' : 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.18, tTime);
      gain.gain.exponentialRampToValueAtTime(0.001, tTime + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(tTime);
      osc.stop(tTime + 0.35);
      tTime += 0.4;
    });
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

function notifyDesktop() {
  if ('Notification' in window && Notification.permission === 'granted') {
    const title = 'Pomocashodoro';
    const body = mode === 'pomodoro' ? tr('pomodoroFinished') : tr('breakFinished');
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐧</text></svg>'
      });
    } catch (e) {}
  }
}

// ---------------- Background Tab & Browser Tab Visibility ----------------
function saveTimerState() {
  try {
    const state = {
      mode,
      roundCurrent,
      isRunning,
      endTimestamp,
      secondsLeft,
      modeState
    };
    localStorage.setItem('pomocashodoro_timer_state', JSON.stringify(state));
  } catch (e) {}
}

function checkAndRestoreActiveTimer() {
  try {
    const raw = localStorage.getItem('pomocashodoro_timer_state');
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state) return;

    if (state.mode) mode = state.mode;
    if (state.roundCurrent) roundCurrent = state.roundCurrent;
    if (state.modeState) modeState = state.modeState;

    if (state.isRunning && state.endTimestamp) {
      const remainingMs = state.endTimestamp - Date.now();
      if (remainingMs > 0) {
        secondsLeft = Math.round(remainingMs / 1000);
        endTimestamp = state.endTimestamp;
        startTimer();
      } else {
        // Expired while tab was closed/inactive
        secondsLeft = 0;
        renderClock();
        onIntervalComplete();
      }
    } else if (typeof state.secondsLeft === 'number') {
      secondsLeft = state.secondsLeft;
      renderClock();
    }
    updateRoundDisplay();
    $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
    $('#timer-card').classList.toggle('is-break', mode !== 'pomodoro');
    updateTaskLabel();
  } catch (e) {}
}

// When returning to tab, synchronize immediately without waiting for tick
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isRunning && endTimestamp) {
    tick();
  }
});
window.addEventListener('focus', () => {
  if (isRunning && endTimestamp) {
    tick();
  }
});

// ==========================================================================
// TASKS
// ==========================================================================

function renderTasks() {
  const list = $('#task-list');
  list.innerHTML = '';
  const doneCount = tasks.filter(tk => tk.isDone).length;

  $('#tasks-count').textContent = `${doneCount}/${tasks.length}`;

  const emptyEl = $('#tasks-empty');
  if (tasks.length === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = tr('noTasksYet');
  } else if (doneCount === tasks.length) {
    emptyEl.hidden = false;
    emptyEl.textContent = tr('allTasksDone');
  } else {
    emptyEl.hidden = true;
  }

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.isDone ? ' is-done' : '') + (task.id === activeTaskId ? ' is-active' : '');
    li.innerHTML = `
      <button type="button" class="task-item__check" data-id="${task.id}" aria-label="${tr('markDone')}"></button>
      <div class="task-item__body" data-id="${task.id}">
        <div class="task-item__title">${escapeHtml(task.title)}</div>
        <div class="task-item__est">${task.doneCount || 0}/${task.estPomodoros} 🍅</div>
      </div>
      <button type="button" class="task-item__del" data-id="${task.id}" aria-label="${tr('deleteTask')}">✕</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.task-item__body').forEach(el => {
    el.addEventListener('click', () => {
      activeTaskId = el.dataset.id;
      saveActiveTaskId();
      renderTasks();
      if (mode === 'pomodoro') $('#timer-task-label').textContent = activeTaskLabel();
    });
  });
  list.querySelectorAll('.task-item__check').forEach(el => {
    el.addEventListener('click', () => toggleTaskDone(el.dataset.id));
  });
  list.querySelectorAll('.task-item__del').forEach(el => {
    el.addEventListener('click', () => deleteTask(el.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

$('#add-task-btn').addEventListener('click', () => {
  $('#add-task-btn').hidden = true;
  $('#task-form').hidden = false;
  $('#task-title').focus();
});

$('#task-cancel-btn').addEventListener('click', () => {
  $('#task-form').hidden = true;
  $('#add-task-btn').hidden = false;
  $('#task-form').reset();
});

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#task-title').value.trim();
  const est = clampInt($('#task-est').value, 1, 12, 1);
  if (!title) return;

  const newTask = {
    id: Date.now().toString(),
    title,
    estPomodoros: est,
    doneCount: 0,
    isDone: false
  };

  tasks.push(newTask);
  if (!activeTaskId) {
    activeTaskId = newTask.id;
    saveActiveTaskId();
    if (mode === 'pomodoro') $('#timer-task-label').textContent = title;
  }

  saveTasks();
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('tasks').doc(newTask.id).set({
      ...newTask, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  renderTasks();
  $('#task-form').hidden = true;
  $('#add-task-btn').hidden = false;
  $('#task-form').reset();
});

function toggleTaskDone(id) {
  const task = tasks.find(tk => tk.id === id);
  if (!task) return;
  task.isDone = !task.isDone;
  saveTasks();
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({ isDone: task.isDone });
  }
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(tk => tk.id !== id);
  if (activeTaskId === id) {
    activeTaskId = null;
    saveActiveTaskId();
    if (mode === 'pomodoro') $('#timer-task-label').textContent = tr('noTaskSelected');
  }
  saveTasks();
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete();
  }
  renderTasks();
}

function incrementTaskDone(id) {
  const task = tasks.find(tk => tk.id === id);
  if (!task) return;
  task.doneCount = (task.doneCount || 0) + 1;
  if (task.doneCount >= task.estPomodoros) task.isDone = true;
  saveTasks();
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({
      doneCount: task.doneCount, isDone: task.isDone
    });
  }
  renderTasks();
}

$('#clear-tasks-btn').addEventListener('click', () => {
  const doneIds = tasks.filter(tk => tk.isDone).map(tk => tk.id);
  tasks = tasks.filter(tk => !tk.isDone);
  if (activeTaskId && doneIds.includes(activeTaskId)) {
    activeTaskId = null;
    saveActiveTaskId();
    if (mode === 'pomodoro') $('#timer-task-label').textContent = tr('noTaskSelected');
  }
  saveTasks();
  if (currentUser && typeof db !== 'undefined') {
    const batch = db.batch();
    doneIds.forEach(id => batch.delete(db.collection('users').doc(currentUser.uid).collection('tasks').doc(id)));
    batch.commit();
  }
  renderTasks();
});

function saveTasks() {
  localStorage.setItem('pomocashodoro_tasks', JSON.stringify(tasks));
}

// BUG FIX: persist activeTaskId so it survives page reloads
function saveActiveTaskId() {
  if (activeTaskId) {
    localStorage.setItem('pomocashodoro_activeTaskId', activeTaskId);
  } else {
    localStorage.removeItem('pomocashodoro_activeTaskId');
  }
}

// ==========================================================================
// SESSIONS / REPORT
// ==========================================================================

function logSession(sessionMode, minutes) {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 1));
  const s = {
    mode: sessionMode,
    minutes: safeMinutes,
    taskTitle: sessionMode === 'pomodoro' ? (activeTaskLabel() || tr('untitledTask')) : (tr(sessionMode === 'short' ? 'shortBreak' : 'longBreak')),
    dateKey: todayKey()
  };
  sessions.unshift(s);
  localStorage.setItem('pomocashodoro_sessions', JSON.stringify(sessions));

  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('sessions').add({
      ...s, completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // BUG FIX: update total hours immediately when logging a session
  renderReportStats();
  renderTotalHours();
}

function renderReport() {
  renderLog();
  renderBarChart();
  renderTotalHours();
  renderReportStats();
}

function renderLog() {
  const body = $('#log-body');
  body.innerHTML = '';
  // BUG FIX: Show all session types (pomodoro + resets from any mode), not just pomodoro
  const allSessions = sessions;
  $('#log-empty').hidden = allSessions.length !== 0;

  allSessions.slice(0, 30).forEach(s => {
    const tr_el = document.createElement('tr');
    const modeLabel = s.mode === 'pomodoro' ? '🍅' : (s.mode === 'short' ? '☕' : '🌿');
    tr_el.innerHTML = `<td>${s.dateKey}</td><td>${modeLabel} ${escapeHtml(s.taskTitle || '—')}</td><td>${s.minutes} ${tr('minShort')}</td>`;
    body.appendChild(tr_el);
  });
}

function renderBarChart() {
  const dayLetters = I18N[currentLanguage]?.dayLetters || I18N.es.dayLetters;
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    days.push({
      key: todayKey(d),
      label: dayLetters[dayOfWeek] || d.toLocaleDateString(undefined, { weekday: 'short' })[0],
      minutes: 0
    });
  }

  sessions.filter(s => s.mode === 'pomodoro').forEach(s => {
    const day = days.find(d => d.key === s.dateKey);
    if (day) day.minutes += Number(s.minutes) || 0;
  });

  const max = Math.max(1, ...days.map(d => d.minutes));
  const chart = $('#bar-chart');
  chart.innerHTML = '';

  days.forEach(d => {
    const col = document.createElement('div');
    col.className = 'bar-chart__col';
    const heightPct = Math.max(2, (d.minutes / max) * 100);
    col.innerHTML = `<div class="bar-chart__bar" style="height:${heightPct}%" title="${d.minutes} min"></div><span class="bar-chart__label">${d.label}</span>`;
    chart.appendChild(col);
  });
}

function renderTotalHours() {
  const totalMinutes = sessions.filter(s => s.mode === 'pomodoro').reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  $('#stat-total-hours').textContent = (totalMinutes / 60).toFixed(1) + 'h';
}

function renderReportStats() {
  $('#stat-days-accessed').textContent = accessDates.length;
  $('#stat-streak').textContent = computeStreak(accessDates);
}

function computeStreak(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = new Date();
  // BUG FIX: check today first, then yesterday, to handle both cases correctly
  if (!set.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(todayKey(cursor))) return 0;
  }
  while (set.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function showToast(msg) {
  const tEl = $('#toast');
  tEl.textContent = msg;
  tEl.hidden = false;
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => { tEl.hidden = true; }, 2400);
}
