/**
 * @file Salchi → Google Calendar sync (Google Apps Script).
 *
 * Copies every open Salchi task that has a due date into a dedicated Google Calendar
 * ("Salchi 🐕") and keeps it up to date every 5 minutes:
 *   - new dated task            → new event
 *   - date or title changed     → event moved / renamed
 *   - task ticked off, undated or deleted → event removed (and re-created if un-ticked)
 *
 * Each event links back to its Notion page, and the page gets the event link in its
 * "Calendario" column, so Salchi can open it with one click.
 *
 * Setup: paste this file into a new project at script.google.com, fill in NOTION_TOKEN and
 * run `install` once. See README.md for the step-by-step guide.
 */

// ============================== Configuration ==============================

/** Notion integration token (starts with "ntn_"), the same one Salchi uses. */
const NOTION_TOKEN = 'PASTE_YOUR_TOKEN_HERE';

/** Link or ID of the Salchi task list, or of the Notion page that contains it. */
const NOTION_DATABASE = '0a2f0c64d4544602b374bbad511803cd';

const CALENDAR_NAME = 'Salchi 🐕';
/** Length of events for tasks that have a time. */
const TIMED_EVENT_MINUTES = 30;
/** Pop-up reminder before timed tasks (0 = none). */
const REMINDER_MINUTES = 15;

// ===========================================================================

/** Notion column names (Spanish, as they appear in the user's workspace). */
const Property = Object.freeze({
  DONE: 'Hecho',
  DUE: 'Fecha',
  CALENDAR_LINK: 'Calendario',
});

const NOTION_API = 'https://api.notion.com/v1/';
const NOTION_VERSION = '2022-06-28';
const SYNC_FUNCTION = 'sync';
const LEGACY_SYNC_FUNCTIONS = ['sincronizar'];

/** Script property keys. Each synced task is stored under `task:<pageId>`. */
const Key = Object.freeze({
  CALENDAR_ID: 'calendarId',
  DATABASE_ID: 'databaseId',
  DATABASE_SOURCE: 'databaseSource',
  TASK_PREFIX: 'task:',
});

/**
 * Run once: creates the calendar, schedules `sync` every 5 minutes and syncs right away.
 */
function install() {
  assertConfigured_();
  migrateLegacyProperties_();
  removeTriggers_();
  ScriptApp.newTrigger(SYNC_FUNCTION).timeBased().everyMinutes(5).create();

  const calendar = getCalendar_();
  const result = sync();
  Logger.log('✅ Done. Calendar "%s": %s dated tasks (%s new). From now on it syncs every 5 minutes.',
    calendar.getName(), result.total, result.created);
}

/**
 * Stops the automatic sync. The calendar itself is kept; delete it from Google Calendar
 * if it is no longer wanted.
 */
function uninstall() {
  removeTriggers_();
  Logger.log('Sync stopped. You can delete the "%s" calendar from Google Calendar.', CALENDAR_NAME);
}

/**
 * Brings the calendar in line with Notion. Called by the trigger; can also be run by hand.
 *
 * @returns {{ total: number, created: number }}
 */
function sync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { total: 0, created: 0 }; // another run is still going

  try {
    assertConfigured_();
    const calendar = getCalendar_();
    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperties();
    const tasks = fetchDatedOpenTasks_(); // throws if Notion fails, so nothing is deleted by mistake
    const seen = {};
    let created = 0;

    tasks.forEach((task) => {
      const key = Key.TASK_PREFIX + task.id;
      seen[key] = true;
      const fingerprint = JSON.stringify([task.title, task.due.start, task.due.end]);
      const previous = stored[key] ? JSON.parse(stored[key]) : null;

      if (previous && previous.fingerprint === fingerprint) {
        // Unchanged. Just make sure Notion still has the link.
        if (task.calendarUrl !== previous.url) setCalendarLink_(task.id, previous.url);
        return;
      }

      const event = upsertEvent_(calendar, previous && previous.eventId, task);
      if (!previous || !previous.eventId || event.getId() !== previous.eventId) created++;

      const url = eventUrl_(event, calendar);
      props.setProperty(key, JSON.stringify({ eventId: event.getId(), fingerprint, url }));
      if (task.calendarUrl !== url) setCalendarLink_(task.id, url);
    });

    // Tasks that were ticked off, lost their date or were deleted: remove their events.
    Object.keys(stored)
      .filter((key) => key.indexOf(Key.TASK_PREFIX) === 0 && !seen[key])
      .forEach((key) => {
        const previous = JSON.parse(stored[key]);
        const event = findEvent_(calendar, previous.eventId);
        if (event) event.deleteEvent();
        props.deleteProperty(key);
        setCalendarLink_(key.slice(Key.TASK_PREFIX.length), null);
      });

    return { total: tasks.length, created };
  } finally {
    lock.releaseLock();
  }
}

// ================================ Calendar =================================

/**
 * Updates the task's event in place, or creates it if it does not exist yet.
 * Switching between all-day and timed recreates the event, since Calendar cannot convert it.
 *
 * @param {GoogleAppsScript.Calendar.Calendar} calendar
 * @param {string | null} eventId - Event created for this task by a previous run, if any.
 * @param {Task} task
 * @returns {GoogleAppsScript.Calendar.CalendarEvent}
 */
function upsertEvent_(calendar, eventId, task) {
  const when = toEventTimes_(task.due);
  let event = eventId ? findEvent_(calendar, eventId) : null;

  if (event && event.isAllDayEvent() !== when.allDay) {
    event.deleteEvent();
    event = null;
  }

  if (event) {
    if (!when.allDay) event.setTime(when.start, when.end);
    else if (when.endExclusive) event.setAllDayDates(when.start, when.endExclusive);
    else event.setAllDayDate(when.start);
  } else if (when.allDay) {
    event = when.endExclusive
      ? calendar.createAllDayEvent(task.title, when.start, when.endExclusive)
      : calendar.createAllDayEvent(task.title, when.start);
  } else {
    event = calendar.createEvent(task.title, when.start, when.end);
    if (REMINDER_MINUTES > 0) event.addPopupReminder(REMINDER_MINUTES);
  }

  event.setTitle(`🐕 ${task.title}`);
  event.setDescription(`Tarea de Salchi 🐕\nAbrir en Notion: ${task.url}`);
  event.setColor(CalendarApp.EventColor.YELLOW);
  return event;
}

/**
 * @returns {GoogleAppsScript.Calendar.Calendar} The "Salchi 🐕" calendar, created on first use.
 */
function getCalendar_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(Key.CALENDAR_ID);
  let calendar = id ? CalendarApp.getCalendarById(id) : null;

  if (!calendar) {
    calendar = CalendarApp.getCalendarsByName(CALENDAR_NAME)[0] ||
      CalendarApp.createCalendar(CALENDAR_NAME, {
        color: CalendarApp.Color.YELLOW,
        summary: 'Tareas con fecha de Salchi 🐕 (se rellena solo desde Notion)',
      });
    props.setProperty(Key.CALENDAR_ID, calendar.getId());
  }
  return calendar;
}

/**
 * @returns {GoogleAppsScript.Calendar.CalendarEvent | null} `null` if it was deleted by hand.
 */
function findEvent_(calendar, eventId) {
  try {
    return calendar.getEventById(eventId);
  } catch (err) {
    return null;
  }
}

/**
 * Converts a Notion date into Calendar times.
 * All-day: "2026-10-30". Timed: "2026-10-30T18:00:00.000+01:00".
 *
 * @param {{ start: string, end: string | null }} due
 * @returns {{ allDay: true, start: Date, endExclusive: Date | null } | { allDay: false, start: Date, end: Date }}
 */
function toEventTimes_(due) {
  const timeZone = Session.getScriptTimeZone();

  if (due.start.length === 10) {
    const start = Utilities.parseDate(due.start, timeZone, 'yyyy-MM-dd');
    let endExclusive = null;
    if (due.end && due.end.length === 10 && due.end > due.start) {
      // Notion's end date is inclusive; Calendar's is exclusive.
      endExclusive = Utilities.parseDate(due.end, timeZone, 'yyyy-MM-dd');
      endExclusive.setDate(endExclusive.getDate() + 1);
    }
    return { allDay: true, start, endExclusive };
  }

  const start = new Date(due.start);
  let end = due.end ? new Date(due.end) : null;
  if (!end || end <= start) end = new Date(start.getTime() + TIMED_EVENT_MINUTES * 60000);
  return { allDay: false, start, end };
}

/**
 * Web link to an event: base64 of "<eventId> <calendarId>", the same as Google Calendar's
 * own "eid" links.
 */
function eventUrl_(event, calendar) {
  const eventId = event.getId().split('@')[0];
  const eid = Utilities.base64EncodeWebSafe(`${eventId} ${calendar.getId()}`).replace(/=+$/, '');
  return `https://www.google.com/calendar/event?eid=${eid}`;
}

// ================================= Notion ==================================

/**
 * @typedef {object} Task
 * @property {string} id - Notion page ID without dashes.
 * @property {string} title
 * @property {{ start: string, end: string | null }} due
 * @property {string} url - Notion page URL.
 * @property {string | null} calendarUrl - Event link currently stored in Notion.
 */

/**
 * Lists the tasks that have a due date and are not ticked off.
 *
 * Notion is asked to filter by date, but it sometimes fails with "Unexpected error" on
 * freshly added columns; in that case all tasks are fetched and filtered here instead.
 *
 * @returns {Task[]}
 */
function fetchDatedOpenTasks_() {
  const databaseId = resolveDatabaseId_();
  const tasks = [];
  let useFilter = true;
  let cursor = null;

  do {
    const body = { page_size: 100 };
    if (useFilter) body.filter = { property: Property.DUE, date: { is_not_empty: true } };
    if (cursor) body.start_cursor = cursor;

    let response;
    try {
      response = notion_(`databases/${databaseId}/query`, 'post', body);
    } catch (err) {
      if (!useFilter || cursor) throw err;
      useFilter = false;
      delete body.filter;
      response = notion_(`databases/${databaseId}/query`, 'post', body);
    }

    (response.results || []).forEach((page) => {
      const task = toTask_(page);
      if (task) tasks.push(task);
    });
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return tasks;
}

/**
 * @param {object} page - A page object from the Notion API.
 * @returns {Task | null} `null` for pages without a date or already ticked off.
 */
function toTask_(page) {
  const props = page.properties || {};
  const values = Object.keys(props).map((name) => props[name]);
  const due = props[Property.DUE] && props[Property.DUE].date;
  if (!due || !due.start) return null;

  // Older lists may name their checkbox differently: fall back to any checkbox.
  const done = props[Property.DONE] && props[Property.DONE].type === 'checkbox'
    ? props[Property.DONE]
    : values.find((value) => value.type === 'checkbox');
  if (done && done.checkbox) return null;

  const titleProperty = values.find((value) => value.type === 'title') || { title: [] };
  const title = titleProperty.title.map((fragment) => fragment.plain_text).join('').trim();

  return {
    id: page.id.replace(/-/g, ''),
    title: title || '(sin título)',
    due: { start: due.start, end: due.end || null },
    url: page.url,
    calendarUrl: (props[Property.CALENDAR_LINK] && props[Property.CALENDAR_LINK].url) || null,
  };
}

/**
 * Accepts either the task list's link or the link of the page Salchi created it in, and
 * returns the database ID. The result is cached until NOTION_DATABASE changes.
 *
 * @returns {string}
 */
function resolveDatabaseId_() {
  const props = PropertiesService.getScriptProperties();
  const sourceId = extractNotionId_(NOTION_DATABASE);
  if (props.getProperty(Key.DATABASE_SOURCE) === sourceId && props.getProperty(Key.DATABASE_ID)) {
    return props.getProperty(Key.DATABASE_ID);
  }

  let databaseId;
  try {
    databaseId = notion_(`databases/${sourceId}`).id;
  } catch (err) {
    // Not a database: look for the "Salchi" list inside the page.
    const children = notion_(`blocks/${sourceId}/children?page_size=100`);
    const list = (children.results || []).find((block) =>
      block.type === 'child_database' && ((block.child_database && block.child_database.title) || '').trim() === 'Salchi');
    if (!list) {
      throw new Error('No encuentro la lista de Salchi en ese enlace. ¿Está compartida con tu integración (••• → Conexiones)?');
    }
    databaseId = list.id;
  }

  databaseId = databaseId.replace(/-/g, '');
  props.setProperty(Key.DATABASE_SOURCE, sourceId);
  props.setProperty(Key.DATABASE_ID, databaseId);
  return databaseId;
}

/**
 * Stores (or clears, with `null`) the event link in the task's "Calendario" column.
 * Fails silently: the page may have been deleted.
 */
function setCalendarLink_(pageId, url) {
  try {
    notion_(`pages/${pageId}`, 'patch', { properties: { [Property.CALENDAR_LINK]: { url: url || null } } });
  } catch (err) {
    // Nothing to do: the page no longer exists or is not shared with the integration.
  }
}

/**
 * Calls the Notion API, retrying transient failures (5xx, 429) with a short back-off.
 *
 * @param {string} endpoint - Path relative to /v1/.
 * @param {'get' | 'post' | 'patch'} [method]
 * @param {object} [body]
 * @returns {object} Parsed JSON response.
 */
function notion_(endpoint, method, body) {
  const options = {
    method: method || 'get',
    headers: { Authorization: `Bearer ${NOTION_TOKEN.trim()}`, 'Notion-Version': NOTION_VERSION },
    contentType: 'application/json',
    muteHttpExceptions: true,
  };
  if (body) options.payload = JSON.stringify(body);

  let response;
  let status;
  for (let attempt = 1; ; attempt++) {
    response = UrlFetchApp.fetch(NOTION_API + endpoint, options);
    status = response.getResponseCode();
    const transient = status >= 500 || status === 429;
    if (!transient || attempt >= 3) break;
    Utilities.sleep(1500 * attempt);
  }

  let json = {};
  try {
    json = JSON.parse(response.getContentText() || '{}');
  } catch (err) {
    // Non-JSON error page: keep the empty object and report the status code below.
  }
  if (status >= 300) throw new Error(`Notion dice: ${json.message || `error ${status}`}`);
  return json;
}

/**
 * Extracts the 32-character ID from a Notion ID or URL.
 *
 * @param {string} text
 * @returns {string}
 */
function extractNotionId_(text) {
  const withoutQuery = String(text).split('?')[0].split('#')[0];
  const lastSegment = withoutQuery.split('/').filter(String).pop() || withoutQuery;
  const undashed = lastSegment.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(undashed)) return undashed.toLowerCase();
  const tail = lastSegment.split('-').pop();
  if (/^[0-9a-f]{32}$/i.test(tail)) return tail.toLowerCase();
  throw new Error('NOTION_DATABASE no parece un enlace o ID de Notion.');
}

// ================================ Utilities ================================

/** Throws a friendly error if the token has not been filled in yet. */
function assertConfigured_() {
  if (!NOTION_TOKEN || NOTION_TOKEN.indexOf('PASTE_') === 0) {
    throw new Error('Falta tu token de Notion: pégalo arriba del todo, en NOTION_TOKEN, y guarda (⌘S / Ctrl+S).');
  }
}

/** Deletes this project's sync triggers, including those created by older versions. */
function removeTriggers_() {
  const handlers = [SYNC_FUNCTION].concat(LEGACY_SYNC_FUNCTIONS);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => handlers.indexOf(trigger.getHandlerFunction()) !== -1)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

/**
 * Renames properties written by the first (Spanish) version of this script, so events it
 * created are updated instead of duplicated.
 */
function migrateLegacyProperties_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach((key) => {
    if (key.indexOf('p_') === 0) {
      const old = JSON.parse(all[key]);
      props.setProperty(Key.TASK_PREFIX + key.slice(2), JSON.stringify({ eventId: old.e, fingerprint: '', url: old.u }));
      props.deleteProperty(key);
    }
  });
  if (all.calendario && !all[Key.CALENDAR_ID]) props.setProperty(Key.CALENDAR_ID, all.calendario);
  ['calendario', 'db', 'db_origen'].forEach((key) => props.deleteProperty(key));
}
