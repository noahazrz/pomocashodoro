/* ==========================================================================
   Pomocashodoro — Temporizador Pomodoro en Español
   ========================================================================== */

// ---------------- Estado Global ----------------
let currentUser = null;

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
let secondsLeft = 25 * 60;

// Estado independiente por cada modo para no reiniciar tiempo al cambiar
let modeState = {
  pomodoro: { secondsLeft: 25 * 60, initialSeconds: 25 * 60 },
  short: { secondsLeft: 5 * 60, initialSeconds: 5 * 60 },
  long: { secondsLeft: 15 * 60, initialSeconds: 15 * 60 }
};

let audioCtx = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------- Temas y Colores ----------------
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

// ---------------- Inicialización Principal ----------------
function init() {
  loadLocalData();
  initAudioContext();
  applyTheme(settings.themeKey || 'forest', settings.customColors);
  applyNumberFont(settings.numberFont || 'sans');
  applySettingsToForm();
  renderTasks();
  renderClock();
  updateRoundDisplay();
  updateTaskLabel();
  renderReport();
  checkAndRestoreActiveTimer();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ---------------- Manejo de Almacenamiento Local ----------------
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
    // Asegurar 100% español siempre
    settings.language = 'es';

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

    const savedActiveTask = localStorage.getItem('pomocashodoro_activeTaskId');
    if (savedActiveTask) activeTaskId = savedActiveTask;

    modeState = {
      pomodoro: { secondsLeft: settings.pomodoro * 60, initialSeconds: settings.pomodoro * 60 },
      short: { secondsLeft: settings.short * 60, initialSeconds: settings.short * 60 },
      long: { secondsLeft: settings.long * 60, initialSeconds: settings.long * 60 }
    };
    secondsLeft = modeState[mode].secondsLeft;

  } catch (e) {
    console.warn('Error al cargar localStorage:', e);
  }
}

function saveSettingsLocally() {
  try {
    settings.language = 'es';
    localStorage.setItem('pomocashodoro_settings', JSON.stringify(settings));
  } catch (e) {}
}

function saveActiveTaskId() {
  try {
    if (activeTaskId) {
      localStorage.setItem('pomocashodoro_activeTaskId', activeTaskId);
    } else {
      localStorage.removeItem('pomocashodoro_activeTaskId');
    }
  } catch (e) {}
}

// ---------------- Temas y Colores ----------------
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

  const pBg = $('#picker-bg');
  const pCard = $('#picker-card');
  const pAccent = $('#picker-accent');
  const pText = $('#picker-text');

  if (pBg) pBg.value = rgbToHex(colors.bg);
  if (pCard) pCard.value = rgbToHex(colors.card);
  if (pAccent) pAccent.value = rgbToHex(colors.accent);
  if (pText) pText.value = rgbToHex(colors.text);
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
  const sel = $('#set-number-font');
  if (sel) sel.value = fontType || 'sans';
}

// ---------------- Temporizador ----------------
function getModeDurationSeconds(m) {
  const min = m === 'pomodoro' ? settings.pomodoro : (m === 'short' ? settings.short : settings.long);
  return min * 60;
}

function setMode(newMode) {
  // 1. Guardar el tiempo restante del modo actual
  if (modeState[mode]) {
    modeState[mode].secondsLeft = secondsLeft;
  }

  // 2. Si estaba corriendo, pausar sin perder el progreso
  if (isRunning) {
    stopTimer();
  }

  // 3. Cambiar a nuevo modo
  mode = newMode;

  // 4. Restaurar tiempo del nuevo modo
  if (!modeState[mode]) {
    const dur = getModeDurationSeconds(mode);
    modeState[mode] = { secondsLeft: dur, initialSeconds: dur };
  }
  secondsLeft = modeState[mode].secondsLeft;

  // 5. Actualizar interfaz
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  const card = $('#timer-card');
  if (card) card.classList.toggle('is-break', mode !== 'pomodoro');
  updateTaskLabel();
  renderClock();
  saveTimerState();
}

function updateTaskLabel() {
  const el = $('#timer-task-label');
  if (!el) return;
  if (mode === 'pomodoro') {
    el.textContent = activeTaskLabel() || 'Ninguna tarea seleccionada';
  } else if (mode === 'short') {
    el.textContent = 'Descanso corto — tómate un respiro';
  } else {
    el.textContent = 'Descanso largo — descansa bien';
  }
}

function updateRoundDisplay() {
  const cur = $('#round-current');
  const tot = $('#round-total');
  if (cur) cur.textContent = Math.min(roundCurrent, settings.rounds);
  if (tot) tot.textContent = settings.rounds;
}

function activeTaskLabel() {
  const item = tasks.find(tk => tk.id === activeTaskId);
  return item ? item.title : '';
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  endTimestamp = Date.now() + secondsLeft * 1000;
  const startBtn = $('#start-btn');
  if (startBtn) {
    startBtn.textContent = 'PAUSAR';
    startBtn.classList.add('is-running');
  }
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
  const startBtn = $('#start-btn');
  if (startBtn) {
    startBtn.textContent = 'INICIAR';
    startBtn.classList.remove('is-running');
  }
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
    const startBtn = $('#start-btn');
    if (startBtn) {
      startBtn.textContent = 'INICIAR';
      startBtn.classList.remove('is-running');
    }
    saveTimerState();
    onIntervalComplete();
  }
}

function renderClock() {
  const clockEl = $('#timer-clock');
  if (!clockEl) return;
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = Math.floor(secondsLeft % 60).toString().padStart(2, '0');
  clockEl.textContent = `${m}:${s}`;
  document.title = isRunning ? `${m}:${s} — Pomocashodoro` : 'Pomocashodoro';
}

function onIntervalComplete() {
  playAlarm();
  notifyDesktop();

  const fullDuration = getModeDurationSeconds(mode) / 60;

  // El modo que acaba de terminar vuelve a su duración completa. Si no, se queda
  // guardado en 00:00 y al volver a esa pestaña hay que darle a REINICIAR a mano
  // (lo que además registraba otra vez el tiempo completo en el reporte).
  modeState[mode] = { secondsLeft: fullDuration * 60, initialSeconds: fullDuration * 60 };

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
  const card = $('#timer-card');
  if (card) card.classList.toggle('is-break', mode !== 'pomodoro');
  updateTaskLabel();
  renderClock();
  saveTimerState();
}

// ---------------- Sonido y Notificaciones ----------------
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
    const body = mode === 'pomodoro' ? '¡Pomodoro terminado! Tómate un descanso.' : '¡Descanso terminado! Hora de concentrarse.';
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐧</text></svg>'
      });
    } catch (e) {}
  }
}

// ---------------- Persistencia del Temporizador al cambiar pestaña ----------------
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

    // Reparar modos que quedaron en 00:00 (o con valores inválidos) por el fallo anterior
    ['pomodoro', 'short', 'long'].forEach(m => {
      const full = getModeDurationSeconds(m);
      const ms = modeState[m];
      const invalid = !ms || typeof ms.secondsLeft !== 'number' || ms.secondsLeft <= 0 || ms.secondsLeft > full;
      if (invalid) modeState[m] = { secondsLeft: full, initialSeconds: full };
      else if (!ms.initialSeconds) ms.initialSeconds = full;
    });
    if (!state.isRunning && typeof state.secondsLeft === 'number' && state.secondsLeft <= 0) {
      state.secondsLeft = modeState[mode].secondsLeft;
    }

    if (state.isRunning && state.endTimestamp) {
      const remainingMs = state.endTimestamp - Date.now();
      if (remainingMs > 0) {
        secondsLeft = Math.round(remainingMs / 1000);
        endTimestamp = state.endTimestamp;
        startTimer();
      } else {
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
    const card = $('#timer-card');
    if (card) card.classList.toggle('is-break', mode !== 'pomodoro');
    updateTaskLabel();
  } catch (e) {}
}

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

// ---------------- Tareas ----------------
function renderTasks() {
  const list = $('#task-list');
  if (!list) return;
  list.innerHTML = '';
  const doneCount = tasks.filter(tk => tk.isDone).length;

  const countEl = $('#tasks-count');
  if (countEl) countEl.textContent = `${doneCount}/${tasks.length}`;

  const emptyEl = $('#tasks-empty');
  if (emptyEl) {
    if (tasks.length === 0) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'No tienes tareas pendientes. ¡Añade una para empezar!';
    } else if (doneCount === tasks.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = '¡Has terminado todas tus tareas de hoy! 🎉';
    } else {
      emptyEl.hidden = true;
    }
  }

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.isDone ? ' is-done' : '') + (task.id === activeTaskId ? ' is-active' : '');
    li.innerHTML = `
      <button type="button" class="task-item__check" data-id="${task.id}" aria-label="Marcar como hecha"></button>
      <div class="task-item__body" data-id="${task.id}">
        <div class="task-item__title">${escapeHtml(task.title)}</div>
        <div class="task-item__est">${task.doneCount || 0}/${task.estPomodoros} 🍅</div>
      </div>
      <button type="button" class="task-item__del" data-id="${task.id}" aria-label="Eliminar tarea">✕</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.task-item__body').forEach(el => {
    el.addEventListener('click', () => {
      activeTaskId = el.dataset.id;
      saveActiveTaskId();
      renderTasks();
      if (mode === 'pomodoro') updateTaskLabel();
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

function toggleTaskDone(id) {
  const task = tasks.find(tk => tk.id === id);
  if (!task) return;
  task.isDone = !task.isDone;
  saveTasks();
  if (currentUser && window.db) {
    try {
      window.db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({ isDone: task.isDone });
    } catch (e) {}
  }
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(tk => tk.id !== id);
  if (activeTaskId === id) {
    activeTaskId = null;
    saveActiveTaskId();
    if (mode === 'pomodoro') updateTaskLabel();
  }
  saveTasks();
  if (currentUser && window.db) {
    try {
      window.db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete();
    } catch (e) {}
  }
  renderTasks();
}

function incrementTaskDone(id) {
  const task = tasks.find(tk => tk.id === id);
  if (!task) return;
  task.doneCount = (task.doneCount || 0) + 1;
  if (task.doneCount >= task.estPomodoros) task.isDone = true;
  saveTasks();
  if (currentUser && window.db) {
    try {
      window.db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({
        doneCount: task.doneCount, isDone: task.isDone
      });
    } catch (e) {}
  }
  renderTasks();
}

function saveTasks() {
  try {
    localStorage.setItem('pomocashodoro_tasks', JSON.stringify(tasks));
  } catch (e) {}
}

// ---------------- Reporte y Sesiones ----------------
function logSession(sessionMode, minutes) {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 1));
  const s = {
    mode: sessionMode,
    minutes: safeMinutes,
    taskTitle: sessionMode === 'pomodoro' ? (activeTaskLabel() || 'Sesión de enfoque') : (sessionMode === 'short' ? 'Descanso corto' : 'Descanso largo'),
    dateKey: todayKey(),
    ts: Date.now()
  };
  sessions.unshift(s);
  try {
    localStorage.setItem('pomocashodoro_sessions', JSON.stringify(sessions));
  } catch (e) {}

  if (currentUser && window.db && typeof firebase !== 'undefined') {
    try {
      window.db.collection('users').doc(currentUser.uid).collection('sessions').add({
        ...s, completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {}
  }

  renderReport();
}

function renderReport() {
  renderLog();
  renderBarChart();
  renderTotalHours();
  renderReportStats();
}

// Hora local de una sesión. Las sesiones antiguas (sin `ts`) no tienen hora guardada;
// las de Firestore la sacan de `completedAt`.
function sessionTimeParts(s) {
  let ms = Number(s.ts);
  if (!ms && s.completedAt && typeof s.completedAt.toMillis === 'function') {
    ms = s.completedAt.toMillis();
  }
  if (!ms) return null;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    short: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    full: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  };
}

function renderLog() {
  const body = $('#log-body');
  if (!body) return;
  body.innerHTML = '';
  const emptyEl = $('#log-empty');
  if (emptyEl) emptyEl.hidden = sessions.length !== 0;

  sessions.slice(0, 30).forEach(s => {
    const tr_el = document.createElement('tr');
    const modeEmoji = s.mode === 'pomodoro' ? '🍅' : (s.mode === 'short' ? '☕' : '🌿');
    const t = sessionTimeParts(s);
    const dateCell = t
      ? `${s.dateKey} <span class="log-time" title="${t.full}">${t.short}</span>`
      : `${s.dateKey}`;
    tr_el.innerHTML = `<td class="log-date">${dateCell}</td><td>${modeEmoji} ${escapeHtml(s.taskTitle || '—')}</td><td>${s.minutes} min</td>`;
    body.appendChild(tr_el);
  });
}

function renderBarChart() {
  const chart = $('#bar-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const dayLetters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    days.push({
      key: todayKey(d),
      label: dayLetters[dayOfWeek],
      minutes: 0
    });
  }

  sessions.filter(s => s.mode === 'pomodoro').forEach(s => {
    const day = days.find(d => d.key === s.dateKey);
    if (day) day.minutes += Number(s.minutes) || 0;
  });

  const max = Math.max(1, ...days.map(d => d.minutes));

  days.forEach(d => {
    const col = document.createElement('div');
    col.className = 'bar-chart__col';
    const heightPct = Math.max(3, (d.minutes / max) * 100);
    col.innerHTML = `<div class="bar-chart__bar" style="height:${heightPct}%" title="${d.minutes} min"></div><span class="bar-chart__label">${d.label}</span>`;
    chart.appendChild(col);
  });
}

function renderTotalHours() {
  const totalHoursEl = $('#stat-total-hours');
  if (!totalHoursEl) return;
  const totalMinutes = sessions.filter(s => s.mode === 'pomodoro').reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  totalHoursEl.textContent = (totalMinutes / 60).toFixed(1) + 'h';
}

function renderReportStats() {
  const daysEl = $('#stat-days-accessed');
  const streakEl = $('#stat-streak');
  if (daysEl) daysEl.textContent = accessDates.length;
  if (streakEl) streakEl.textContent = computeStreak(accessDates);
}

function computeStreak(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = new Date();
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

// ---------------- Modal de Configuración ----------------
function openSettings() {
  applySettingsToForm();
  const m = $('#settings-modal');
  if (m) m.hidden = false;
}

function closeSettings() {
  const m = $('#settings-modal');
  if (m) m.hidden = true;
}

function applySettingsToForm() {
  const setP = $('#set-pomodoro');
  const setS = $('#set-short');
  const setL = $('#set-long');
  const setR = $('#set-rounds');
  const setAB = $('#set-autostart-breaks');
  const setAP = $('#set-autostart-pomodoros');
  const setAS = $('#set-alarm-sound');
  const setNF = $('#set-number-font');
  const rTot = $('#round-total');

  if (setP) setP.value = settings.pomodoro;
  if (setS) setS.value = settings.short;
  if (setL) setL.value = settings.long;
  if (setR) setR.value = settings.rounds;
  if (setAB) setAB.checked = !!settings.autoStartBreaks;
  if (setAP) setAP.checked = !!settings.autoStartPomodoros;
  if (setAS) setAS.value = settings.alarmSound || 'bell';
  if (setNF) setNF.value = settings.numberFont || 'sans';
  if (rTot) rTot.textContent = settings.rounds;
}

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---------------- Modal de Temas y Colores ----------------
function openThemeModal() {
  const tm = $('#theme-modal');
  if (tm) tm.hidden = false;
}

function closeThemeModal() {
  const tm = $('#theme-modal');
  if (tm) tm.hidden = true;
}

// ---------------- Notificaciones Toast ----------------
function showToast(msg) {
  const tEl = $('#toast');
  if (!tEl) return;
  tEl.textContent = msg;
  tEl.hidden = false;
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => { tEl.hidden = true; }, 2600);
}

// ---------------- Registro de Event Listeners ----------------
function setupEventListeners() {
  // 1. Navegación entre pestañas (Temporizador <-> Reporte)
  // No reinicia ni afecta el temporizador en ejecución
  $$('.navlink').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.navlink').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const view = btn.dataset.view;
      const vTimer = $('#view-timer');
      const vReport = $('#view-report');
      if (vTimer) vTimer.hidden = view !== 'timer';
      if (vReport) vReport.hidden = view !== 'report';
      if (view === 'report') renderReport();
    });
  });

  // 2. Modos del temporizador (Pomodoro <-> Descanso corto <-> Descanso largo)
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.mode;
      if (mode === targetMode) return;
      setMode(targetMode);
    });
  });

  // 3. Botón de INICIAR / PAUSAR
  const startBtn = $('#start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      requestNotificationPermission();
      if (isRunning) {
        stopTimer();
      } else {
        startTimer();
      }
    });
  }

  // 4. Botón de REINICIAR (Reset)
  const resetBtn = $('#reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Feedback visual inmediato con animación de rotación
      resetBtn.classList.add('is-spinning');
      setTimeout(() => resetBtn.classList.remove('is-spinning'), 450);

      const initial = modeState[mode].initialSeconds || getModeDurationSeconds(mode);
      const elapsedSec = Math.max(0, initial - secondsLeft);

      // Si pasaron al menos 5 segundos, sumar y registrar en el reporte
      if (secondsLeft > 0 && elapsedSec >= 5) {
        const elapsedMinutes = Math.max(1, Math.round(elapsedSec / 60));
        logSession(mode, elapsedMinutes);
        showToast(`Tiempo guardado: ${elapsedMinutes} min en el reporte.`);
      } else {
        showToast('Temporizador reiniciado.');
      }

      // Detener y reiniciar reloj a la duración completa
      stopTimer();
      const fullDur = getModeDurationSeconds(mode);
      secondsLeft = fullDur;
      modeState[mode].secondsLeft = fullDur;
      modeState[mode].initialSeconds = fullDur;
      renderClock();
      saveTimerState();
      renderReport();
    });
  }

  // 5. Botón de Color (🎨) en el header: ABRE EL SELECTOR DE COLORES
  const themeQuickBtn = $('#theme-quick-btn');
  if (themeQuickBtn) {
    themeQuickBtn.addEventListener('click', () => {
      openThemeModal();
    });
  }

  // Cerrar modal de temas
  const themeCloseBtn = $('#theme-close-btn');
  if (themeCloseBtn) themeCloseBtn.addEventListener('click', closeThemeModal);
  const themeDoneBtn = $('#theme-done-btn');
  if (themeDoneBtn) themeDoneBtn.addEventListener('click', closeThemeModal);

  const themeModal = $('#theme-modal');
  if (themeModal) {
    themeModal.addEventListener('click', (e) => {
      if (e.target === themeModal) closeThemeModal();
    });
  }

  // 6. Selección de Temas Predefinidos
  $$('.theme-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.themeKey;
      settings.themeKey = key;
      settings.customColors = null;
      applyTheme(key, null);
      saveSettingsLocally();
      showToast(`Tema aplicado: ${THEMES[key].name}`);
    });
  });

  // 7. Personalización de colores exactos
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

  const pBg = $('#picker-bg');
  const pCard = $('#picker-card');
  const pAccent = $('#picker-accent');
  const pText = $('#picker-text');

  if (pBg) pBg.addEventListener('input', onCustomColorChange);
  if (pCard) pCard.addEventListener('input', onCustomColorChange);
  if (pAccent) pAccent.addEventListener('input', onCustomColorChange);
  if (pText) pText.addEventListener('input', onCustomColorChange);

  const resetColorsBtn = $('#reset-colors-btn');
  if (resetColorsBtn) {
    resetColorsBtn.addEventListener('click', () => {
      settings.themeKey = 'forest';
      settings.customColors = null;
      applyTheme('forest', null);
      saveSettingsLocally();
      showToast('Colores restablecidos a predeterminados.');
    });
  }

  // 8. Modal de Configuración (⚙)
  const settingsBtn = $('#settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  const settingsCloseBtn = $('#settings-close-btn');
  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettings);

  const settingsModal = $('#settings-modal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeThemeModal();
    }
  });

  // Guardar configuración
  const settingsSaveBtn = $('#settings-save-btn');
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', () => {
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
      settings.language = 'es';

      applyNumberFont(settings.numberFont);

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
      if (currentUser && window.db) {
        try {
          window.db.collection('users').doc(currentUser.uid).set({ settings }, { merge: true });
        } catch (e) {}
      }

      updateRoundDisplay();
      closeSettings();
      showToast('Configuración guardada.');
    });
  }

  // 9. Tareas
  const addTaskBtn = $('#add-task-btn');
  const taskForm = $('#task-form');
  const taskTitle = $('#task-title');
  const taskCancelBtn = $('#task-cancel-btn');

  if (addTaskBtn && taskForm) {
    addTaskBtn.addEventListener('click', () => {
      addTaskBtn.hidden = true;
      taskForm.hidden = false;
      if (taskTitle) taskTitle.focus();
    });
  }

  if (taskCancelBtn && taskForm && addTaskBtn) {
    taskCancelBtn.addEventListener('click', () => {
      taskForm.hidden = true;
      addTaskBtn.hidden = false;
      taskForm.reset();
    });
  }

  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
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
        if (mode === 'pomodoro') updateTaskLabel();
      }

      saveTasks();
      if (currentUser && window.db && typeof firebase !== 'undefined') {
        try {
          window.db.collection('users').doc(currentUser.uid).collection('tasks').doc(newTask.id).set({
            ...newTask, createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {}
      }

      renderTasks();
      taskForm.hidden = true;
      if (addTaskBtn) addTaskBtn.hidden = false;
      taskForm.reset();
    });
  }

  const clearTasksBtn = $('#clear-tasks-btn');
  if (clearTasksBtn) {
    clearTasksBtn.addEventListener('click', () => {
      const doneIds = tasks.filter(tk => tk.isDone).map(tk => tk.id);
      tasks = tasks.filter(tk => !tk.isDone);
      if (activeTaskId && doneIds.includes(activeTaskId)) {
        activeTaskId = null;
        saveActiveTaskId();
        if (mode === 'pomodoro') updateTaskLabel();
      }
      saveTasks();
      if (currentUser && window.db) {
        try {
          const batch = window.db.batch();
          doneIds.forEach(id => batch.delete(window.db.collection('users').doc(currentUser.uid).collection('tasks').doc(id)));
          batch.commit();
        } catch (e) {}
      }
      renderTasks();
    });
  }

  // 10. Firebase Auth
  const googleLoginBtn = $('#google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      if (!window.auth || typeof firebase === 'undefined') {
        showToast('Configuración de Firebase no disponible');
        return;
      }
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await window.auth.signInWithPopup(provider);
      } catch (err) {
        showToast('Error al iniciar sesión: ' + (err.message || err));
      }
    });
  }

  const logoutBtn = $('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (window.auth) {
        try {
          await window.auth.signOut();
        } catch (err) {
          console.warn('Error al cerrar sesión:', err);
        }
      }
    });
  }

  if (window.auth) {
    try {
      window.auth.onAuthStateChanged(async (user) => {
        if (user) {
          currentUser = user;
          const gBtn = $('#google-login-btn');
          const chip = $('#user-chip');
          const uName = $('#user-name');
          if (gBtn) gBtn.hidden = true;
          if (chip) chip.hidden = false;
          if (uName) uName.textContent = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
          await syncWithFirestore();
          showToast('Sincronizado con Google');
        } else {
          currentUser = null;
          const gBtn = $('#google-login-btn');
          const chip = $('#user-chip');
          if (gBtn) gBtn.hidden = false;
          if (chip) chip.hidden = true;
        }
      });
    } catch (e) {}
  }
}

async function syncWithFirestore() {
  if (!currentUser || !window.db) return;

  try {
    const userRef = window.db.collection('users').doc(currentUser.uid);
    const snap = await userRef.get();

    if (snap.exists) {
      const data = snap.data();
      if (data.settings) {
        settings = Object.assign(settings, data.settings);
        settings.language = 'es';
        applyTheme(settings.themeKey, settings.customColors);
        applyNumberFont(settings.numberFont);
      }
      if (Array.isArray(data.accessDates)) {
        accessDates = Array.from(new Set([...accessDates, ...data.accessDates]));
      }
      applySettingsToForm();
    }

    if (!accessDates.includes(todayKey())) accessDates.push(todayKey());
    await userRef.set({ settings, accessDates }, { merge: true });

    const taskSnap = await userRef.collection('tasks').orderBy('createdAt', 'asc').get();
    if (!taskSnap.empty) {
      tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTasks();
    }

    const sessionSnap = await userRef.collection('sessions').orderBy('completedAt', 'desc').limit(50).get();
    if (!sessionSnap.empty) {
      sessions = sessionSnap.docs.map(d => d.data());
      renderReport();
    }

    renderReportStats();
  } catch (e) {
    console.warn('Error al sincronizar con Firestore:', e);
  }
}
