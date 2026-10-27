/**
 * @file End-to-end test of the Notion edition against an in-memory fake of the Notion API.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isolateUserData, runScenario, captureMenus, localDate } = require('./harness');

const DATABASE_ID = '0a2f0c64d4544602b374bbad511803cd';

/* ---- Fake Notion API ---------------------------------------------------- */

const calls = [];
let schemaPatch = null;
const pages = [
  { id: 'p1', title: 'Undated', due: null, done: false },
  { id: 'p2', title: 'Dentist', due: `${localDate(2)}T17:30:00.000+01:00`, done: false, calendarUrl: 'https://www.google.com/calendar/event?eid=abc' },
  { id: 'p3', title: 'Overdue', due: localDate(-2), done: false },
];

/** Serializes a fake page the way the real API does. */
function toApiPage(page) {
  const properties = {
    Tarea: { type: 'title', title: [{ plain_text: page.title }] },
    Hecho: { type: 'checkbox', checkbox: page.done },
  };
  if (schemaPatch) {
    properties.Fecha = { type: 'date', date: page.due ? { start: page.due } : null };
    properties.Calendario = { type: 'url', url: page.calendarUrl || null };
  }
  return { id: page.id, properties };
}

global.fetch = async (url, options) => {
  const endpoint = url.replace('https://api.notion.com/v1/', '');
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ method: options.method, endpoint, body });
  const ok = (json) => ({ ok: true, json: async () => json });

  if (endpoint === `databases/${DATABASE_ID}` && options.method === 'GET') {
    return ok({ id: DATABASE_ID, properties: { Tarea: {}, Hecho: {}, ...(schemaPatch && { Fecha: {}, Calendario: {} }) } });
  }
  if (endpoint === `databases/${DATABASE_ID}` && options.method === 'PATCH') {
    schemaPatch = body;
    return ok({});
  }
  if (endpoint.endsWith('/query')) {
    // Like the real API: sorting by a column that does not exist is an error.
    if (!schemaPatch) return { ok: false, json: async () => ({ message: 'Could not find sort property' }) };
    return ok({ results: pages.filter((p) => !p.done).map(toApiPage) }); // deliberately unsorted
  }
  if (endpoint === 'pages' && options.method === 'POST') {
    const page = { id: `p${pages.length + 1}`, title: body.properties.title.title[0].text.content, due: body.properties.Fecha?.date.start || null, done: false };
    pages.push(page);
    return ok({ id: page.id });
  }
  if (endpoint.startsWith('pages/') && options.method === 'PATCH') {
    const page = pages.find((p) => p.id === endpoint.slice('pages/'.length));
    if ('Fecha' in body.properties) page.due = body.properties.Fecha.date ? body.properties.Fecha.date.start : null;
    if ('Hecho' in body.properties) page.done = body.properties.Hecho.checkbox;
    return ok({});
  }
  return { ok: false, json: async () => ({ message: `unexpected ${options.method} ${endpoint}` }) };
};

/* ---- Scenario ------------------------------------------------------------ */

const userData = isolateUserData();
fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({
  token: Buffer.from('ntn_test').toString('base64'),
  tokenEncrypted: false,
  databaseId: DATABASE_ID,
  checkbox: 'Hecho', // 1.0 key: must be migrated to doneProperty
  autostartSet: true,
  pinned: true,
}));
const menus = captureMenus();

const rowTexts = (js) => js(`[...document.querySelectorAll('.row')].map(r =>
  r.querySelector('.t').textContent + ' | ' + (r.querySelector('.due')?.textContent || '-'))`);

runScenario(async ({ js, wait, check }) => {
  console.log('Notion edition');
  check(JSON.stringify(schemaPatch) === JSON.stringify({ properties: { Fecha: { date: {} }, Calendario: { url: {} } } }),
    'adds the Fecha and Calendario columns to an old list');

  const first = await rowTexts(js);
  check(first[0].startsWith('Overdue') && first[1].startsWith('Dentist') && first[2].startsWith('Undated'),
    'sorts dated tasks first, earliest first');
  check(await js(`document.querySelector('.due').classList.contains('overdue')`), 'marks overdue dates');
  check(await js(`!!document.querySelectorAll('.row')[1].querySelector('.due svg:last-child path')`), 'shows the calendar link icon');
  check(await js(`document.body.dataset.edition`) === 'notion', 'renders the Notion edition');

  // New task for tomorrow at 18:30, chosen with the picker.
  await js(`$('draftDateButton').click();
    document.querySelector('[data-pick="tomorrow"]').click();
    $('hasTimeInput').checked = true; $('hasTimeInput').onchange();
    $('timeInput').value = '18:30'; $('timeInput').oninput();
    $('confirmDueButton').click();`);
  check((await js(`$('draftDueChip').textContent`)) === 'mañana · 18:30', 'shows the chosen date next to the text box');
  await js(`$('draftInput').value = 'Call Rodri'; $('draftInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))`);
  await wait(400);
  const created = calls.find((c) => c.endpoint === 'pages' && c.method === 'POST');
  check(created && /^\d{4}-\d{2}-\d{2}T18:30:00[+-]\d{2}:\d{2}$/.test(created.body.properties.Fecha.date.start) &&
    created.body.properties.Fecha.date.start.startsWith(localDate(1)), 'creates the task with date, time and UTC offset');

  // Move "Undated" to the 20th of next month, then clear the dentist's date.
  await js(`openPicker('p1'); $('nextMonth').click();
    [...document.querySelectorAll('#calendarGrid button')].find(b => b.textContent === '20').click();
    $('confirmDueButton').click();`);
  await wait(300);
  check(/^\d{4}-\d{2}-20$/.test(pages.find((p) => p.id === 'p1').due), 'changes the date of an existing task');
  await js(`openPicker('p2'); $('clearDueButton').click();`);
  await wait(300);
  check(pages.find((p) => p.id === 'p2').due === null, 'removes a date');

  // Context menu.
  await js(`window.salchi.send('task-menu', 'p3')`);
  await wait(200);
  check(menus.last().map((i) => i.label).filter(Boolean).join(' / ') ===
    'Hecho / Cambiar fecha… / Quitar fecha / Abrir en Notion', 'context menu has the Notion actions');
  menus.click('Hecho');
  await wait(900);
  check(pages.find((p) => p.id === 'p3').done === true, 'ticking a task marks it done in Notion');
  check(!(await rowTexts(js)).some((r) => r.startsWith('Overdue')), 'done tasks leave the list');

  const savedConfig = JSON.parse(fs.readFileSync(path.join(userData, 'config.json'), 'utf8'));
  check(savedConfig.doneProperty === 'Hecho' && !('checkbox' in savedConfig), 'migrates the 1.0 config key');
});
