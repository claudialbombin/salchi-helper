/**
 * @file Translations for the desktop app.
 *
 * The strings live in the repository's top-level `locales` folder, one JSON file per
 * language, and are shared with the Mac app. In a packaged build electron-builder copies
 * that folder into the app's resources (see build/config.base.js).
 *
 * The main process owns the current language: it translates menus, the tray and error
 * messages itself, and sends the whole string table to the renderer.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Used whenever a string or a whole language is missing. */
const FALLBACK = 'en-US';

/**
 * @returns {string} Folder that holds `languages.json` and the `<code>.json` files.
 */
function localesDir() {
  const packaged = process.resourcesPath && path.join(process.resourcesPath, 'locales');
  if (packaged && fs.existsSync(path.join(packaged, 'languages.json'))) return packaged;
  return path.join(__dirname, '..', '..', '..', 'locales');
}

const DIR = localesDir();

/** @type {{ code: string, name: string, dir: 'ltr' | 'rtl' }[]} */
const LANGUAGES = JSON.parse(fs.readFileSync(path.join(DIR, 'languages.json'), 'utf8')).languages;
const CODES = new Set(LANGUAGES.map((language) => language.code));

/** @type {Map<string, Record<string, string>>} Parsed tables, loaded on first use. */
const tables = new Map();

/**
 * @param {string} code - A supported language code.
 * @returns {Record<string, string>} The language's strings, with English filling any gap.
 */
function table(code) {
  if (!tables.has(code)) {
    const read = (c) => JSON.parse(fs.readFileSync(path.join(DIR, `${c}.json`), 'utf8'));
    tables.set(code, code === FALLBACK ? read(code) : { ...table(FALLBACK), ...read(code) });
  }
  return tables.get(code);
}

/**
 * Maps an OS or installer locale (e.g. "es-MX", "zh-TW", "nn", "pt") to the closest language
 * Salchi speaks.
 *
 * @param {string | null | undefined} locale
 * @returns {string | null} A supported code, or `null` when nothing is close enough.
 */
function matchLocale(locale) {
  if (!locale) return null;
  const tag = String(locale).replace('_', '-');
  const exact = [...CODES].find((code) => code.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;

  const [lang, ...rest] = tag.toLowerCase().split('-');
  const region = rest.find((part) => part.length === 2) || '';
  const script = rest.find((part) => part.length === 4) || '';

  switch (lang) {
    case 'en':
      // Commonwealth spelling is closer to British English.
      return ['gb', 'ie', 'au', 'nz', 'za', 'in', 'mt'].includes(region) ? 'en-GB' : 'en-US';
    case 'pt':
      return region && region !== 'br' ? 'pt-PT' : 'pt-BR';
    case 'zh':
      return script === 'hant' || ['tw', 'hk', 'mo'].includes(region) ? 'zh-Hant' : 'zh-Hans';
    case 'no':
    case 'nn':
      return 'nb';
    case 'iw':
      return 'he'; // old Java/Android code for Hebrew
    case 'in':
      return 'id'; // old code for Indonesian
    default:
      return CODES.has(lang) ? lang : null;
  }
}

/**
 * @param {string[]} locales - Preferred locales, most preferred first.
 * @returns {string} The first one Salchi speaks, or English.
 */
function bestLanguage(locales) {
  for (const locale of locales) {
    const code = matchLocale(locale);
    if (code) return code;
  }
  return FALLBACK;
}

/**
 * Builds a translator for one language.
 *
 * @param {string} code
 * @returns {(key: string, params?: Record<string, string | number>) => string}
 */
function translator(code) {
  const strings = table(CODES.has(code) ? code : FALLBACK);
  return (key, params = {}) =>
    (strings[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Translator for the current language; see `setLanguage`. */
let current = translator(FALLBACK);
let currentCode = FALLBACK;

/**
 * Switches the language used by `t` everywhere in the main process.
 *
 * @param {string} code
 */
function setLanguage(code) {
  currentCode = CODES.has(code) ? code : FALLBACK;
  current = translator(currentCode);
}

/**
 * @param {string} code
 * @returns {'ltr' | 'rtl'}
 */
function directionOf(code) {
  return LANGUAGES.find((language) => language.code === code)?.dir || 'ltr';
}

module.exports = {
  FALLBACK,
  LANGUAGES,
  isSupported: (code) => CODES.has(code),
  matchLocale,
  bestLanguage,
  translator,
  strings: (code) => table(CODES.has(code) ? code : FALLBACK),
  directionOf,
  setLanguage,
  language: () => currentCode,
  /** Translates `key` into the current language, filling `{placeholders}` from `params`. */
  t: (key, params) => current(key, params),
};
