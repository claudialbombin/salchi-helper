/**
 * @file Helpers for task due dates.
 *
 * Due dates travel as strings in the same format Notion uses, so both editions can share
 * them unchanged:
 *   - all-day:   "2026-10-30"
 *   - with time: "2026-10-30T18:00:00+01:00"
 */
'use strict';

const DUE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

/** Default length of a timed task when it is turned into a calendar event. */
const TIMED_EVENT_MINUTES = 30;

/**
 * Validates a due date coming from the renderer or from Notion.
 *
 * @param {unknown} value
 * @returns {string | null} The value when it is a well-formed due date, otherwise `null`.
 */
function normalizeDue(value) {
  return typeof value === 'string' && DUE_PATTERN.test(value) ? value : null;
}

/**
 * @param {string} due - A due date that passed `normalizeDue`.
 * @returns {boolean} `true` for all-day dates (no time component).
 */
function isAllDay(due) {
  return due.length === 10;
}

/**
 * Converts a due date into a sortable timestamp. All-day dates count as local midnight.
 *
 * @param {string | null | undefined} due
 * @returns {number} Milliseconds since the epoch, or `Infinity` when there is no date.
 */
function dueTimestamp(due) {
  if (!due) return Infinity;
  if (isAllDay(due)) {
    const [year, month, day] = due.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const time = Date.parse(due);
  return Number.isNaN(time) ? Infinity : time;
}

/**
 * Sorts tasks the same way Notion does in our query: dated tasks first (earliest first),
 * then undated ones in the order they were added. The sort is stable.
 *
 * @template {{ due?: string | null }} T
 * @param {T[]} tasks
 * @returns {T[]} A new, sorted array.
 */
function sortByDue(tasks) {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => (dueTimestamp(a.task.due) - dueTimestamp(b.task.due)) || (a.index - b.index))
    .map(({ task }) => task);
}

/**
 * Builds a Google Calendar "create event" link with the task already filled in.
 * Used by the local edition, which has no background sync with Google.
 *
 * @param {{ title: string, due: string }} task
 * @returns {string}
 */
function googleCalendarTemplateUrl(task) {
  const pad = (n) => String(n).padStart(2, '0');
  const compactDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const compactUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  let dates;
  if (isAllDay(task.due)) {
    // Google expects the end date to be exclusive, so a one-day event ends the next day.
    const [year, month, day] = task.due.split('-').map(Number);
    dates = `${compactDate(new Date(year, month - 1, day))}/${compactDate(new Date(year, month - 1, day + 1))}`;
  } else {
    const start = new Date(task.due);
    const end = new Date(start.getTime() + TIMED_EVENT_MINUTES * 60_000);
    dates = `${compactUtc(start)}/${compactUtc(end)}`;
  }

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🐕 ${task.title}`,
    dates,
    details: 'Apuntado en Salchi 🐕',
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}

/**
 * Only Google Calendar links may be opened from the renderer.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
function isGoogleCalendarUrl(url) {
  return typeof url === 'string' &&
    /^https:\/\/(www\.google\.com\/calendar\/|calendar\.google\.com\/)/.test(url);
}

module.exports = {
  normalizeDue,
  dueTimestamp,
  sortByDue,
  googleCalendarTemplateUrl,
  isGoogleCalendarUrl,
};
