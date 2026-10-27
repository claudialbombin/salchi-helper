/**
 * @file Renderer logic for the Salchi window.
 *
 * The renderer is intentionally "dumb": the main process owns the data and sends the whole
 * UI state on every change (`window.salchi.onState`). This file only renders that state and
 * forwards user actions back through `window.salchi.send`.
 *
 * Local UI state that never leaves the renderer:
 *   - the date picker (which task it is editing, the visible month…),
 *   - the due date chosen for the task that is being typed.
 */
'use strict';

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => document.getElementById(id);

/** Latest state received from the main process. */
let state = null;
/** Serialized task list last rendered, to skip re-rendering when nothing changed. */
let renderedListKey = '';

/** Inline SVG icons (kept here so they inherit `currentColor`). */
const ICONS = {
  calendar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="3" width="11.6" height="10.8" rx="2"/><path d="M2.2 6.6h11.6M5.4 1.6v2.6M10.6 1.6v2.6"/></svg>',
  calendarPlus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="3" width="11.6" height="10.8" rx="2"/><path d="M2.2 6.6h11.6M5.4 1.6v2.6M10.6 1.6v2.6M8 8.6v3.4M6.3 10.3h3.4"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.5"/></svg>',
  link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6.6 9.4l2.8-2.8M7.2 4.6l1-1a2.8 2.8 0 0 1 4 4l-1 1M8.8 11.4l-1 1a2.8 2.8 0 0 1-4-4l1-1"/></svg>',
};

/* ========================================================================== Dates
 * Due dates use Notion's string format:
 *   "2026-10-30"                 → all day
 *   "2026-10-30T18:00:00+01:00"  → at a given time
 */

const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} date @returns {Date} Local midnight of the same day. */
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** @returns {number} Whole days from `b` to `a` (negative if `a` is earlier). */
const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);

/**
 * @param {string | null | undefined} due
 * @returns {{ date: Date, hasTime: boolean } | null}
 */
function parseDue(due) {
  if (!due) return null;
  if (due.length === 10) {
    const [year, month, day] = due.split('-').map(Number);
    return { date: new Date(year, month - 1, day), hasTime: false };
  }
  const date = new Date(due);
  return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
}

/**
 * Builds a due-date string from the picker's values.
 *
 * @param {Date} day - Local midnight of the chosen day.
 * @param {string | null} time - "HH:MM", or `null` for an all-day task.
 * @returns {string}
 */
function formatDue(day, time) {
  const ymd = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  if (!time) return ymd;

  const [hours, minutes] = time.split(':').map(Number);
  // The UTC offset depends on the date itself (daylight saving time), not on today.
  const local = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  const offset = -local.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${ymd}T${pad(hours)}:${pad(minutes)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * Human-friendly label: "hoy", "mañana", "jueves", "30 oct", "3 ene 2027"… plus the time.
 *
 * @param {{ date: Date, hasTime: boolean }} due
 * @returns {string}
 */
function dueLabel(due) {
  const now = new Date();
  const days = dayDiff(due.date, now);
  let label;

  if (days === 0) label = 'hoy';
  else if (days === 1) label = 'mañana';
  else if (days === -1) label = 'ayer';
  else if (days >= 2 && days <= 6) label = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(due.date);
  else {
    const sameYear = due.date.getFullYear() === now.getFullYear();
    const options = sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
    label = new Intl.DateTimeFormat('es-ES', options).format(due.date).replace(/\./g, '');
  }

  if (due.hasTime) label += ` · ${pad(due.date.getHours())}:${pad(due.date.getMinutes())}`;
  return label;
}

/**
 * @param {{ date: Date, hasTime: boolean }} due
 * @returns {'overdue' | 'today' | 'later'} Used as a CSS class to colour the label.
 */
function dueUrgency(due) {
  const now = new Date();
  const overdue = due.hasTime ? due.date < now : dayDiff(due.date, now) < 0;
  if (overdue) return 'overdue';
  return dayDiff(due.date, now) === 0 ? 'today' : 'later';
}

/* ========================================================================== Rendering */

/**
 * Applies a new state from the main process.
 *
 * @param {object} next
 */
function render(next) {
  state = next;
  document.body.dataset.edition = state.edition;
  document.body.classList.toggle('expanded', state.expanded);

  const count = state.tasks.length;
  $('sticker').textContent = count ? String(count) : '✓';
  // Two-digit counts need a slightly wider sticker.
  $('stickerBg').setAttribute('width', count > 9 ? 26 : 22);
  $('stickerBg').setAttribute('x', count > 9 ? 33 : 35);
  $('errorBadge').toggleAttribute('hidden', !state.error);

  $('count').textContent = count;
  $('spinner').classList.toggle('on', state.loading);
  $('pinButton').classList.toggle('active', state.pinned);
  $('autostartLabel').textContent = navigator.userAgent.includes('Windows')
    ? 'Abrir al iniciar Windows'
    : 'Abrir al iniciar sesión';

  if (state.settings && $('settings').hidden) fillSettings();

  // Close the date picker if the task it was editing is gone (completed elsewhere, say).
  if (picker.target && picker.target !== NEW_TASK && !state.tasks.some((t) => t.id === picker.target)) {
    picker.target = null;
  }
  updateLayout();

  const listKey = JSON.stringify([state.tasks, state.completing, state.error]);
  if (listKey !== renderedListKey) {
    renderedListKey = listKey;
    renderTaskList();
  }
}

/**
 * Shows exactly one of: the task list, the date picker or the settings.
 */
function updateLayout() {
  const pickerOpen = picker.target !== null && !state.settings;
  $('settings').hidden = !state.settings;
  $('datePanel').hidden = !pickerOpen;
  $('taskList').hidden = state.settings || pickerOpen;
  // While picking a date for an existing task there is nothing to type.
  $('addBar').hidden = state.settings || (pickerOpen && picker.target !== NEW_TASK);
}

/**
 * Rebuilds the task list from scratch. Lists are short, so this is simpler and fast enough.
 */
function renderTaskList() {
  const list = $('taskList');
  list.textContent = '';

  if (state.error) list.appendChild(textElement('div', 'err', state.error));
  if (!state.tasks.length && !state.error) list.appendChild(textElement('div', 'empty', 'nada pendiente ✨'));

  for (const task of state.tasks) list.appendChild(taskRow(task));
}

/**
 * @param {object} task
 * @returns {HTMLElement}
 */
function taskRow(task) {
  const done = state.completing.includes(task.id);
  const pending = task.id.startsWith('pending-');

  const row = document.createElement('div');
  row.className = 'row' + (done ? ' done' : '') + (pending ? ' tmp' : '');

  const check = document.createElement('button');
  check.className = 'check' + (done ? ' done' : '');
  check.title = 'Hecho';
  check.onclick = () => window.salchi.send('complete-task', task.id);

  const body = document.createElement('div');
  body.className = 'body';
  body.appendChild(textElement('span', 't', task.title));
  const due = dueElement(task);
  if (due) body.appendChild(due);

  row.append(check, body);
  if (pending) return row; // not saved yet: nothing else can be done with it

  const dateButton = document.createElement('button');
  dateButton.className = 'rowdate';
  dateButton.title = task.due ? 'Cambiar fecha' : 'Ponerle fecha';
  dateButton.innerHTML = task.due ? ICONS.calendar : ICONS.calendarPlus;
  dateButton.onclick = () => openPicker(task.id);
  row.appendChild(dateButton);

  if (state.edition === 'local') {
    const remove = textElement('button', 'del', '✕');
    remove.title = 'Borrar';
    remove.onclick = () => window.salchi.send('delete-task', task.id);
    row.appendChild(remove);
  }

  row.oncontextmenu = (event) => {
    event.preventDefault();
    window.salchi.send('task-menu', task.id);
  };
  return row;
}

/**
 * The small coloured line under a task title. Clicking it opens the Google Calendar event
 * when there is one, or the date picker otherwise.
 *
 * @param {object} task
 * @returns {HTMLElement | null}
 */
function dueElement(task) {
  const due = parseDue(task.due);
  if (!due) return null;

  const element = document.createElement('span');
  element.className = `due ${dueUrgency(due)}`;
  element.innerHTML = due.hasTime ? ICONS.clock : ICONS.calendar;
  element.append(document.createTextNode(dueLabel(due)));

  if (task.calendarUrl) {
    element.insertAdjacentHTML('beforeend', ICONS.link);
    element.title = 'Está en tu Google Calendar (clic para abrirlo)';
    element.onclick = () => window.salchi.send('open-url', task.calendarUrl);
  } else {
    element.title = 'Cambiar fecha';
    element.onclick = () => openPicker(task.id);
  }
  return element;
}

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/* ========================================================================== Date picker */

/** Picker target meaning "the task being typed", as opposed to an existing task ID. */
const NEW_TASK = 'new';

const picker = {
  /** @type {string | null} `NEW_TASK`, a task ID, or `null` when closed. */
  target: null,
  /** @type {Date | null} Selected day (local midnight). */
  day: null,
  /** @type {Date | null} First day of the month on display. */
  month: null,
  hasTime: false,
  time: '09:00',
  canClear: false,
};

/** Due date chosen for the task that is being typed. */
let draftDue = null;

/**
 * Opens the picker for the task being typed or for an existing task.
 *
 * @param {string} target - `NEW_TASK` or a task ID.
 */
function openPicker(target) {
  let current = null;
  let title = '¿Para cuándo?';

  if (target === NEW_TASK) {
    current = draftDue;
  } else {
    const task = state.tasks.find((t) => t.id === target);
    if (!task) return;
    current = task.due || null;
    title = `📅 ${task.title}`;
  }

  const due = parseDue(current);
  picker.target = target;
  picker.day = startOfDay(due ? due.date : new Date());
  picker.month = new Date(picker.day.getFullYear(), picker.day.getMonth(), 1);
  picker.hasTime = due ? due.hasTime : false;
  picker.time = due && due.hasTime ? `${pad(due.date.getHours())}:${pad(due.date.getMinutes())}` : '09:00';
  picker.canClear = !!due;

  $('datePanelTitle').textContent = title;
  $('datePanelTitle').title = title;
  renderPicker();
  updateLayout();
  syncEditing();
}

/**
 * Closes the picker without changing anything.
 */
function closePicker() {
  picker.target = null;
  updateLayout();
  syncEditing();
}

/**
 * Draws the month grid and the time controls.
 */
function renderPicker() {
  $('hasTimeInput').checked = picker.hasTime;
  $('timeInput').hidden = !picker.hasTime;
  $('timeInput').value = picker.time;
  $('clearDueButton').hidden = !picker.canClear;

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(picker.month);
  $('monthLabel').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const grid = $('calendarGrid');
  grid.textContent = '';
  for (const weekday of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) grid.appendChild(textElement('div', 'wd', weekday));

  // Weeks start on Monday in Spain; getDay() counts from Sunday.
  const first = picker.month;
  const leadingBlanks = (first.getDay() + 6) % 7;
  for (let i = 0; i < leadingBlanks; i++) grid.appendChild(document.createElement('span'));

  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = startOfDay(new Date()).getTime();
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const date = new Date(first.getFullYear(), first.getMonth(), dayNumber);
    const time = date.getTime();
    const button = textElement('button', '', String(dayNumber));
    button.classList.toggle('past', time < today);
    button.classList.toggle('today', time === today);
    button.classList.toggle('sel', time === picker.day.getTime());
    button.onclick = () => {
      picker.day = date;
      renderPicker();
    };
    grid.appendChild(button);
  }
}

/**
 * Selects a day and jumps the grid to its month.
 *
 * @param {Date} date
 */
function selectDay(date) {
  picker.day = startOfDay(date);
  picker.month = new Date(picker.day.getFullYear(), picker.day.getMonth(), 1);
  renderPicker();
}

/**
 * @param {number} weekday - 0 = Sunday … 6 = Saturday.
 * @returns {Date} The next such day, never today.
 */
function nextWeekday(weekday) {
  const date = startOfDay(new Date());
  do date.setDate(date.getDate() + 1); while (date.getDay() !== weekday);
  return date;
}

/**
 * Confirms the picker: stores the date for the draft, or saves it on the existing task.
 *
 * @param {string | null} due - `null` removes the date.
 */
function applyDue(due) {
  const target = picker.target;
  if (target === NEW_TASK) {
    draftDue = due;
    renderDraftDue();
    closePicker();
    $('draftInput').focus();
  } else if (target) {
    window.salchi.send('set-due', { id: target, due });
    closePicker();
  }
}

/**
 * Shows the chosen date next to the text box, if any.
 */
function renderDraftDue() {
  const due = parseDue(draftDue);
  $('draftDueChip').hidden = !due;
  $('draftDueChip').textContent = due ? dueLabel(due) : '';
  $('draftDateButton').innerHTML = due ? ICONS.calendar : ICONS.calendarPlus;
}

/* ========================================================================== Typing */

/** Last "editing" flag sent to the main process, to avoid redundant messages. */
let lastEditing = null;

/**
 * Tells the main process whether the list must stay open even if the cursor leaves it
 * (half-typed task, or the date picker in use).
 */
function syncEditing() {
  const draft = $('draftInput');
  const hasText = draft.value.trim() !== '';
  const editing = picker.target !== null
    || (document.activeElement === draft && hasText)
    || (!!draftDue && hasText);
  if (editing !== lastEditing) {
    lastEditing = editing;
    window.salchi.send('ui', { editing });
  }
}

/**
 * Adds the typed task (with its due date, if one was chosen) and clears the box.
 */
function submitDraft() {
  const draft = $('draftInput');
  const title = draft.value.trim();
  if (title) {
    window.salchi.send('add-task', { title, due: draftDue });
    draftDue = null;
    renderDraftDue();
    if (picker.target === NEW_TASK) closePicker();
  }
  draft.value = '';
  syncEditing();
}

/* ========================================================================== Settings */

/**
 * Pre-fills the settings form. The token is never sent back to the renderer, only
 * whether one is stored.
 */
function fillSettings() {
  $('tokenInput').value = '';
  $('tokenInput').placeholder = state.hasToken ? 'Token guardado ✓ (pega otro para cambiarlo)' : 'Token (ntn_…)';
  $('linkInput').value = state.databaseId ? `https://www.notion.so/${state.databaseId}` : '';
  $('autostartInput').checked = state.autostart;
  $('settingsMessage').textContent = '';
  $('settingsMessage').className = '';
}

/**
 * Sends the Notion settings and shows the result.
 */
async function saveSettings() {
  const button = $('saveSettingsButton');
  const message = $('settingsMessage');
  button.disabled = true;
  message.className = '';
  message.textContent = 'Conectando…';

  const result = await window.salchi.saveSettings({ token: $('tokenInput').value, link: $('linkInput').value });

  button.disabled = false;
  message.className = result.ok ? '' : 'bad';
  message.textContent = result.ok ? '' : result.error;
}

/* ========================================================================== Dragging */

/**
 * Lets the user move the window by dragging an element. The main process does the actual
 * moving; the pointer is captured so the drag survives the cursor leaving the element.
 *
 * @param {HTMLElement | SVGElement} element
 * @param {string} [ignoreSelector] - Clicks on matching children do not start a drag.
 */
function makeDraggable(element, ignoreSelector) {
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || (ignoreSelector && event.target.closest(ignoreSelector))) return;
    element.setPointerCapture(event.pointerId);
    window.salchi.send('drag-start');
  });
  const end = () => window.salchi.send('drag-end');
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
}

/* ========================================================================== Wiring */

/**
 * Connects every control to its handler. Called once at start-up.
 */
function bindEvents() {
  // Hover is reported to the main process; it is only used on Linux (see floating-window.js).
  document.documentElement.addEventListener('mouseenter', () => window.salchi.send('hover', true));
  document.documentElement.addEventListener('mouseleave', () => window.salchi.send('hover', false));

  makeDraggable($('dog'));
  makeDraggable($('head'), 'button');

  $('refreshButton').onclick = () => window.salchi.send('refresh');
  $('pinButton').onclick = () => window.salchi.send('ui', { pinned: !state.pinned });
  $('settingsButton').onclick = () => window.salchi.send('ui', { settings: !state.settings });

  // Date picker.
  const quickPicks = {
    today: () => new Date(),
    tomorrow: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
    saturday: () => nextWeekday(6),
    monday: () => nextWeekday(1),
  };
  document.querySelectorAll('#quickPicks button').forEach((button) => {
    button.onclick = () => selectDay(quickPicks[button.dataset.pick]());
  });
  $('prevMonth').onclick = () => {
    picker.month = new Date(picker.month.getFullYear(), picker.month.getMonth() - 1, 1);
    renderPicker();
  };
  $('nextMonth').onclick = () => {
    picker.month = new Date(picker.month.getFullYear(), picker.month.getMonth() + 1, 1);
    renderPicker();
  };
  $('hasTimeInput').onchange = () => {
    picker.hasTime = $('hasTimeInput').checked;
    renderPicker();
    if (picker.hasTime) $('timeInput').focus();
  };
  $('timeInput').oninput = () => { picker.time = $('timeInput').value || '09:00'; };
  $('datePanelClose').onclick = closePicker;
  $('clearDueButton').onclick = () => applyDue(null);
  $('confirmDueButton').onclick = () => applyDue(formatDue(picker.day, picker.hasTime ? picker.time : null));

  // Typing a new task.
  const draft = $('draftInput');
  draft.addEventListener('input', syncEditing);
  draft.addEventListener('blur', syncEditing);
  draft.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitDraft();
    else if (event.key === 'Escape') draft.blur();
  });
  $('draftDueChip').onclick = () => openPicker(NEW_TASK);
  $('draftDateButton').onclick = () => (picker.target === NEW_TASK ? closePicker() : openPicker(NEW_TASK));

  // Settings.
  $('saveSettingsButton').onclick = saveSettings;
  $('autostartInput').onchange = () => window.salchi.send('set-autostart', $('autostartInput').checked);

  // Actions chosen in the native right-click menu.
  window.salchi.onTaskAction(({ action, id }) => {
    if (action === 'pick-date') openPicker(id);
  });
}

bindEvents();
renderDraftDue();
window.salchi.onState(render);
window.salchi.send('ready');
