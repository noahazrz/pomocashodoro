/* ==========================================================================
   Pomocashodoro — focus timer
   Vanilla JS, Firebase Auth + Firestore for accounts and online storage.
   ========================================================================== */

// ---------- State ----------
let currentUser = null;
let settings = {
  pomodoro: 25,
  short: 5,
  long: 15,
  rounds: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  alarmSound: 'bell'
};

let tasks = [];          // [{id, title, estPomodoros, doneCount, isDone}]
let activeTaskId = null;

let mode = 'pomodoro';   // 'pomodoro' | 'short' | 'long'
let roundCurrent = 1;
let secondsLeft = settings.pomodoro * 60;
let isRunning = false;
let tickHandle = null;
let endTimestamp = null; // ms epoch when the current run should end

// ---------- DOM shortcuts ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const authScreen = $('#auth-screen');
const appShell = $('#app-shell');

// ==========================================================================
// AUTH
// ==========================================================================

const googleProvider = new firebase.auth.GoogleAuthProvider();

$('#google-signin-btn').addEventListener('click', async () => {
  const errEl = $('#auth-error');
  errEl.textContent = '';
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (err) {
    errEl.textContent = friendlyAuthError(err);
  }
});

$('#logout-btn').addEventListener('click', () => auth.signOut());

function friendlyAuthError(err) {
  const map = {
    'auth/popup-closed-by-user': 'Sign-in was closed before finishing — try again.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup — allow popups for this site and try again.',
    'auth/cancelled-popup-request': 'Sign-in was interrupted — try again.',
    'auth/unauthorized-domain': 'This site isn\'t authorized for Google sign-in yet — add it under Firebase Authentication → Settings → Authorized domains.'
  };
  return map[err.code] || err.message;
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await ensureUserDoc(user);
    await loadUserData();
    authScreen.hidden = true;
    appShell.hidden = false;
  } else {
    currentUser = null;
    stopTimer();
    authScreen.hidden = false;
    appShell.hidden = true;
  }
});

async function ensureUserDoc(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: user.displayName || user.email,
      email: user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      settings,
      accessDates: [todayKey()]
    });
  }
}

// ==========================================================================
// LOAD / SYNC USER DATA
// ==========================================================================

async function loadUserData() {
  const userRef = db.collection('users').doc(currentUser.uid);
  const snap = await userRef.get();
  const data = snap.data() || {};

  $('#user-name').textContent = data.name || currentUser.email;

  settings = Object.assign(settings, data.settings || {});
  applySettingsToForm();

  const dates = new Set(data.accessDates || []);
  const today = todayKey();
  dates.add(today);
  const accessDates = Array.from(dates).sort();
  await userRef.set({ accessDates }, { merge: true });

  renderReportStats(accessDates);

  await loadTasks();
  await loadRecentSessions();

  resetTimerForMode(mode, true);
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function computeStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;
  const set = new Set(sortedDates);
  let streak = 0;
  let cursor = new Date();
  if (!set.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ==========================================================================
// SETTINGS MODAL
// ==========================================================================

function openSettings() {
  $('#settings-modal').hidden = false;
}

function closeSettings() {
  $('#settings-modal').hidden = true;
}

$('#settings-btn').addEventListener('click', openSettings);
$('#settings-close-btn').addEventListener('click', closeSettings);

// Close on backdrop click or ESC key
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
  $('#set-alarm-sound').value = settings.alarmSound;
  $('#round-total').textContent = settings.rounds;
}

$('#settings-save-btn').addEventListener('click', async () => {
  settings = {
    pomodoro: clampInt($('#set-pomodoro').value, 1, 90, 25),
    short: clampInt($('#set-short').value, 1, 60, 5),
    long: clampInt($('#set-long').value, 1, 90, 15),
    rounds: clampInt($('#set-rounds').value, 2, 12, 4),
    autoStartBreaks: $('#set-autostart-breaks').checked,
    autoStartPomodoros: $('#set-autostart-pomodoros').checked,
    alarmSound: $('#set-alarm-sound').value
  };
  $('#round-total').textContent = settings.rounds;

  if (currentUser) {
    await db.collection('users').doc(currentUser.uid).set({ settings }, { merge: true });
  }

  closeSettings();

  // Switch to Timer view if not active
  $$('.navlink').forEach(b => b.classList.toggle('is-active', b.dataset.view === 'timer'));
  $('#view-timer').hidden = false;
  $('#view-report').hidden = true;

  // Set to pomodoro mode, refresh duration, and start timer immediately
  setMode('pomodoro');
  stopTimer();
  resetTimerForMode('pomodoro', true);
  startTimer();

  showToast('Settings saved & Pomodoro started');
});

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ==========================================================================
// NAVIGATION (Timer / Report)
// ==========================================================================

$$('.navlink').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.navlink').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const view = btn.dataset.view;
    $('#view-timer').hidden = view !== 'timer';
    $('#view-report').hidden = view !== 'report';
    if (view === 'report') refreshReport();
  });
});

// ==========================================================================
// TIMER
// ==========================================================================

$$('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) stopTimer();
    setMode(btn.dataset.mode);
  });
});

function setMode(newMode) {
  mode = newMode;
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  $('#timer-card').classList.toggle('is-break', mode !== 'pomodoro');
  $('#timer-task-label').textContent = mode === 'pomodoro'
    ? (activeTaskLabel() || 'No task selected')
    : (mode === 'short' ? 'Short break — step away for a bit' : 'Long break — rest up');
  resetTimerForMode(mode, true);
}

function resetTimerForMode(m, updateDisplay) {
  const minutes = m === 'pomodoro' ? settings.pomodoro : (m === 'short' ? settings.short : settings.long);
  secondsLeft = minutes * 60;
  if (updateDisplay) renderClock();
}

function activeTaskLabel() {
  const t = tasks.find(t => t.id === activeTaskId);
  return t ? t.title : '';
}

$('#start-btn').addEventListener('click', () => {
  if (isRunning) stopTimer(); else startTimer();
});

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  endTimestamp = Date.now() + secondsLeft * 1000;
  $('#start-btn').textContent = 'PAUSE';
  $('#start-btn').classList.add('is-running');
  renderClock();
  tickHandle = setInterval(tick, 250);
}

function stopTimer() {
  isRunning = false;
  clearInterval(tickHandle);
  $('#start-btn').textContent = 'START';
  $('#start-btn').classList.remove('is-running');
  renderClock();
}

function tick() {
  const remainingMs = endTimestamp - Date.now();
  secondsLeft = Math.max(0, Math.round(remainingMs / 1000));
  renderClock();
  if (remainingMs <= 0) {
    clearInterval(tickHandle);
    isRunning = false;
    $('#start-btn').textContent = 'START';
    $('#start-btn').classList.remove('is-running');
    onIntervalComplete();
  }
}

function renderClock() {
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = Math.floor(secondsLeft % 60).toString().padStart(2, '0');
  $('#timer-clock').textContent = `${m}:${s}`;
  document.title = isRunning ? `${m}:${s} — Pomocashodoro` : 'Pomocashodoro';
}

async function onIntervalComplete() {
  playAlarm();

  if (mode === 'pomodoro') {
    await logSession('pomodoro', settings.pomodoro);
    if (activeTaskId) await incrementTaskDone(activeTaskId);

    const nextIsLong = roundCurrent >= settings.rounds;
    setModeSilently(nextIsLong ? 'long' : 'short');
    if (nextIsLong) roundCurrent = 1; else roundCurrent++;
    $('#round-current').textContent = Math.min(roundCurrent, settings.rounds);

    if (settings.autoStartBreaks) startTimer();
  } else {
    await logSession(mode, mode === 'short' ? settings.short : settings.long);
    setModeSilently('pomodoro');
    if (settings.autoStartPomodoros) startTimer();
  }
}

function setModeSilently(newMode) {
  mode = newMode;
  $$('.mode-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  $('#timer-card').classList.toggle('is-break', mode !== 'pomodoro');
  $('#timer-task-label').textContent = mode === 'pomodoro'
    ? (activeTaskLabel() || 'No task selected')
    : 'Time for a break';
  resetTimerForMode(mode, true);
}

function playAlarm() {
  if (settings.alarmSound === 'none') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = settings.alarmSound === 'digital' ? [880, 880, 880] : [660, 880];
    let t = ctx.currentTime;
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = settings.alarmSound === 'digital' ? 'square' : 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
      t += 0.4;
    });
  } catch (e) { /* audio unavailable */ }
}

// ==========================================================================
// TASKS
// ==========================================================================

async function loadTasks() {
  const snap = await db.collection('users').doc(currentUser.uid)
    .collection('tasks').orderBy('createdAt', 'asc').get();
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!tasks.some(t => t.id === activeTaskId)) activeTaskId = null;
  renderTasks();
}

function renderTasks() {
  const list = $('#task-list');
  list.innerHTML = '';
  const doneCount = tasks.filter(t => t.isDone).length;

  $('#tasks-count').textContent = `${doneCount}/${tasks.length}`;
  $('#tasks-empty').hidden = tasks.length !== 0;

  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.isDone ? ' is-done' : '') + (t.id === activeTaskId ? ' is-active' : '');
    li.innerHTML = `
      <button class="task-item__check" data-id="${t.id}" aria-label="Toggle done"></button>
      <div class="task-item__body" data-id="${t.id}">
        <div class="task-item__title">${escapeHtml(t.title)}</div>
        <div class="task-item__est">${t.doneCount || 0}/${t.estPomodoros} 🍅</div>
      </div>
      <button class="task-item__del" data-id="${t.id}" aria-label="Delete task">✕</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.task-item__body').forEach(el => {
    el.addEventListener('click', () => {
      activeTaskId = el.dataset.id;
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
  const ref = await db.collection('users').doc(currentUser.uid).collection('tasks').add({
    title, estPomodoros: est, doneCount: 0, isDone: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  tasks.push({ id: ref.id, title, estPomodoros: est, doneCount: 0, isDone: false });
  if (!activeTaskId) {
    activeTaskId = ref.id;
    if (mode === 'pomodoro') $('#timer-task-label').textContent = title;
  }
  renderTasks();
  $('#task-form').hidden = true;
  $('#add-task-btn').hidden = false;
  $('#task-form').reset();
});

async function toggleTaskDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.isDone = !t.isDone;
  renderTasks();
  await db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({ isDone: t.isDone });
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (activeTaskId === id) activeTaskId = null;
  renderTasks();
  await db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete();
}

async function incrementTaskDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.doneCount = (t.doneCount || 0) + 1;
  if (t.doneCount >= t.estPomodoros) t.isDone = true;
  renderTasks();
  await db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({
    doneCount: t.doneCount, isDone: t.isDone
  });
}

$('#clear-tasks-btn').addEventListener('click', async () => {
  const doneTasks = tasks.filter(t => t.isDone);
  tasks = tasks.filter(t => !t.isDone);
  renderTasks();
  const batch = db.batch();
  doneTasks.forEach(t => {
    batch.delete(db.collection('users').doc(currentUser.uid).collection('tasks').doc(t.id));
  });
  await batch.commit();
});

// ==========================================================================
// SESSIONS / REPORT
// ==========================================================================

async function logSession(sessionMode, minutes) {
  await db.collection('users').doc(currentUser.uid).collection('sessions').add({
    mode: sessionMode,
    minutes,
    taskTitle: sessionMode === 'pomodoro' ? (activeTaskLabel() || 'Untitled task') : null,
    dateKey: todayKey(),
    completedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function loadRecentSessions() {
  const snap = await db.collection('users').doc(currentUser.uid)
    .collection('sessions').orderBy('completedAt', 'desc').limit(20).get();
  const sessions = snap.docs.map(d => d.data());
  renderLog(sessions);
  renderBarChart(sessions);
  renderTotalHours(sessions);
}

function renderLog(sessions) {
  const body = $('#log-body');
  body.innerHTML = '';
  const pomodoroSessions = sessions.filter(s => s.mode === 'pomodoro');
  $('#log-empty').hidden = pomodoroSessions.length !== 0;
  pomodoroSessions.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.dateKey}</td><td>${escapeHtml(s.taskTitle || '—')}</td><td>${s.minutes} min</td>`;
    body.appendChild(tr);
  });
}

function renderBarChart(recentSessions) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' })[0], minutes: 0 });
  }
  recentSessions.filter(s => s.mode === 'pomodoro').forEach(s => {
    const day = days.find(d => d.key === s.dateKey);
    if (day) day.minutes += s.minutes;
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

function renderTotalHours(recentSessions) {
  const totalMinutes = recentSessions.filter(s => s.mode === 'pomodoro').reduce((sum, s) => sum + s.minutes, 0);
  $('#stat-total-hours').textContent = (totalMinutes / 60).toFixed(1) + 'h';
}

function renderReportStats(accessDates) {
  $('#stat-days-accessed').textContent = accessDates.length;
  $('#stat-streak').textContent = computeStreak(accessDates);
}

async function refreshReport() {
  await loadRecentSessions();
}

// ==========================================================================
// MISC
// ==========================================================================

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => { t.hidden = true; }, 2200);
}

$('#round-total').textContent = settings.rounds;
