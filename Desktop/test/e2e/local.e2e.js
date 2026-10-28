/**
 * @file End-to-end test of the local edition (tasks stored in a JSON file).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { isolateUserData, runScenario, captureMenus, localDate } = require('./harness');

const userData = isolateUserData();
fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ autostartSet: true, pinned: true, language: 'es' }));
// Tasks saved by version 1.0, with Spanish keys: they must survive the upgrade.
fs.writeFileSync(path.join(userData, 'tareas.json'), JSON.stringify({
  pendientes: [
    { id: 'a1', title: 'Old task', creada: '2026-10-01T10:00:00Z' },
    { id: 'a2', title: 'Buy a present', creada: '2026-10-02T10:00:00Z', due: localDate(5) },
  ],
  hechas: [{ id: 'z', title: 'Something done', creada: '2026-09-01T10:00:00Z', hecha: '2026-09-02T10:00:00Z' }],
}));

const opened = [];
shell.openExternal = async (url) => { opened.push(url); };
const menus = captureMenus();
const readTasks = () => JSON.parse(fs.readFileSync(path.join(userData, 'tasks.json'), 'utf8'));

runScenario(async ({ js, wait, check }) => {
  console.log('Local edition');
  const migrated = readTasks();
  check(migrated.pending.length === 2 && migrated.pending[0].createdAt && migrated.done[0].completedAt,
    'migrates tasks saved by version 1.0');
  check(await js(`document.body.dataset.edition`) === 'local', 'renders the local edition');
  check(await js(`getComputedStyle($('refreshButton')).display`) === 'none', 'hides Notion-only controls');

  await js(`$('draftDateButton').click(); document.querySelector('[data-pick="today"]').click(); $('confirmDueButton').click();
    $('draftInput').value = 'Laundry'; $('draftInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))`);
  await wait(300);
  check(readTasks().pending[0].title === 'Laundry' && readTasks().pending[0].due === localDate(0), 'saves a task due today, first in the list');

  await js(`openPicker('a1'); document.querySelector('[data-pick="saturday"]').click();
    $('hasTimeInput').checked = true; $('hasTimeInput').onchange();
    $('timeInput').value = '11:15'; $('timeInput').oninput(); $('confirmDueButton').click();`);
  await wait(300);
  const a1 = readTasks().pending.find((t) => t.id === 'a1');
  check(/T11:15:00[+-]\d{2}:\d{2}$/.test(a1.due), 'gives an existing task a date and time');

  await js(`window.salchi.send('task-menu', 'a1')`);
  await wait(200);
  check(menus.last().map((i) => i.label).filter(Boolean).join(' / ') ===
    'Hecho / Cambiar fecha… / Quitar fecha / Añadir a Google Calendar / Borrar', 'context menu has the local actions');
  menus.click('Añadir a Google Calendar');
  const url = new URL(opened[0] || 'https://invalid/');
  const expectedStart = new Date(a1.due).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  check(url.hostname === 'calendar.google.com' && url.searchParams.get('dates').startsWith(expectedStart),
    'opens a pre-filled Google Calendar event in UTC');

  await js(`window.salchi.send('task-menu', 'a2')`);
  menus.click('Borrar');
  await wait(200);
  check(!readTasks().pending.some((t) => t.id === 'a2'), 'deletes a task');

  await js(`[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Laundry')).querySelector('.check').click()`);
  await wait(900);
  check(readTasks().done.some((t) => t.title === 'Laundry' && t.completedAt), 'keeps ticked tasks in the history');
});
