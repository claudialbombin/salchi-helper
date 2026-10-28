/**
 * @file End-to-end test of the languages: the first-run chooser, switching language from the
 * settings, translated menus and dates, and right-to-left layout.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { isolateUserData, runScenario, captureMenus, localDate } = require('./harness');

// A first start: no language chosen yet, and an English-speaking system.
const userData = isolateUserData();
fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ autostartSet: true }));
fs.writeFileSync(path.join(userData, 'tasks.json'), JSON.stringify({
  pending: [{ id: 'a1', title: 'Pay rent', createdAt: '2026-10-01T10:00:00Z', due: localDate(1) }],
  done: [],
}));
app.getPreferredSystemLanguages = () => ['en-GB', 'es-ES'];

const menus = captureMenus();
const readConfig = () => JSON.parse(fs.readFileSync(path.join(userData, 'config.json'), 'utf8'));
const trayLabels = () => menus.built().filter((t) => t.some((item) => item.label && /Salchi/.test(item.label)))
  .at(-1).map((item) => item.label).filter(Boolean);
const locales = path.join(__dirname, '..', '..', '..', 'locales');
const strings = (code) => JSON.parse(fs.readFileSync(path.join(locales, `${code}.json`), 'utf8'));

runScenario(async ({ js, wait, check }) => {
  console.log('Languages');

  check(await js(`!$('languagePanel').hidden && $('taskList').hidden`), 'asks for a language on the first start');
  check(await js(`document.querySelectorAll('#languageList button').length`) === 46, 'offers all 46 languages');
  check(await js(`document.querySelector('#languageList .sel').lang`) === 'en-GB', 'preselects the system language');
  check(await js(`$('languageContinueButton').textContent`) === 'Continue', 'speaks the guessed language meanwhile');

  // Pick French and continue.
  await js(`[...document.querySelectorAll('#languageList button')].find((b) => b.lang === 'fr').click();
    $('languageContinueButton').click();`);
  await wait(400);
  check(readConfig().language === 'fr', 'remembers the chosen language');
  check(await js(`$('languagePanel').hidden && !$('taskList').hidden`), 'shows the list once a language is chosen');
  check(await js(`$('draftInput').placeholder`) === strings('fr')['draft.placeholder'], 'translates the interface');
  check(await js(`document.querySelector('.due').textContent`) === strings('fr')['due.tomorrow'], 'translates due dates');
  check(trayLabels()[0] === strings('fr')['tray.toggle'], 'translates the tray menu');

  await js(`window.salchi.send('task-menu', 'a1')`);
  await wait(200);
  check(menus.last()[0].label === strings('fr')['task.done'], 'translates the right-click menu');

  // Calendar: French weeks start on Monday, American ones on Sunday.
  await js(`openPicker('a1')`);
  check(await js(`document.querySelector('#calendarGrid .wd').textContent`) === 'L', 'starts French weeks on Monday');
  await js(`closePicker(); $('languageSelect').value = 'en-US'; $('languageSelect').onchange();`);
  await wait(300);
  await js(`openPicker('a1')`);
  check(await js(`document.querySelector('#calendarGrid .wd').textContent`) === 'S', 'starts American weeks on Sunday');
  check(await js(`$('datePanelTitle').textContent.startsWith('📅')`) && readConfig().language === 'en-US',
    'switches language from the settings');
  await js(`closePicker()`);

  // Right-to-left languages mirror the layout.
  await js(`$('languageSelect').value = 'ar'; $('languageSelect').onchange();`);
  await wait(300);
  check(await js(`document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'`), 'mirrors the layout for Arabic');
  check(await js(`$('draftInput').placeholder`) === strings('ar')['draft.placeholder'], 'translates into Arabic');

  // Every language file has every key.
  const keys = Object.keys(strings('en-US'));
  const languages = JSON.parse(fs.readFileSync(path.join(locales, 'languages.json'), 'utf8')).languages;
  const incomplete = languages.filter(({ code }) => keys.some((key) => !(key in strings(code))));
  check(incomplete.length === 0, 'every language has every string');
});
