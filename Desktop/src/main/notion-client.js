/**
 * @file Minimal client for the Notion REST API, limited to what Salchi needs.
 *
 * Docs: https://developers.notion.com/reference
 */
'use strict';

const { t } = require('./i18n');

const NOTION_API = 'https://api.notion.com/v1/';
const NOTION_VERSION = '2022-06-28';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Column names in the Notion database. They are user-visible in Notion, so they are kept in
 * Spanish to match the rest of the user's workspace.
 */
const Property = Object.freeze({
  TITLE: 'Tarea',
  DONE: 'Hecho',
  DUE: 'Fecha',
  CALENDAR_LINK: 'Calendario',
});

/** Title of the database Salchi creates when it is given a plain page. */
const DATABASE_TITLE = 'Salchi';

/**
 * Extracts the 32-character Notion ID from an ID or any Notion URL
 * (`notion.so/Title-<id>`, `app.notion.com/p/<id>`, dashed UUIDs, `?pvs=` suffixes…).
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function extractNotionId(raw) {
  const text = String(raw || '').trim();
  const withoutQuery = text.split('?')[0].split('#')[0];
  const lastSegment = withoutQuery.split('/').filter(Boolean).pop() || withoutQuery;
  const isId = (value) => /^[0-9a-fA-F]{32}$/.test(value);

  const undashed = lastSegment.replace(/-/g, '');
  if (isId(undashed)) return undashed.toLowerCase();

  // "My-Page-Title-0123…" → the ID is the last dash-separated chunk.
  const tail = lastSegment.split('-').pop();
  if (isId(tail)) return tail.toLowerCase();

  return null;
}

/**
 * Thin wrapper around `fetch` for the Notion endpoints Salchi uses.
 */
class NotionClient {
  /**
   * @param {() => string | null} getToken - Returns the integration token at call time,
   *   so a token changed in the settings is picked up without recreating the client.
   */
  constructor(getToken) {
    /** @private */
    this.getToken = getToken;
  }

  /**
   * Performs an authenticated API call.
   *
   * @param {string} endpoint - Path relative to `/v1/`, e.g. `pages/<id>`.
   * @param {'GET' | 'POST' | 'PATCH'} [method]
   * @param {object} [body]
   * @returns {Promise<any>} Parsed JSON response.
   * @throws {Error} With a user-friendly (Spanish) message, shown as-is in the UI.
   */
  async request(endpoint, method = 'GET', body) {
    const token = this.getToken();
    if (!token) throw new Error(t('errors.missingToken'));

    let response;
    try {
      response = await fetch(NOTION_API + endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error(t('errors.offline'));
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || t('errors.notResponding'));
    return json;
  }

  /**
   * Turns whatever link the user pasted into the ID of a task database.
   *
   * - A database link is used as is.
   * - A page link reuses the "Salchi" database inside it if there is one (so several
   *   computers configured with the same page share the same list), or creates it.
   *
   * @param {string} link
   * @returns {Promise<{ databaseId: string, doneProperty: string }>}
   */
  async resolveTaskDatabase(link) {
    const id = extractNotionId(link);
    if (!id) throw new Error(t('errors.badLink'));

    let database;
    try {
      database = await this.request(`databases/${id}`);
    } catch {
      await this.request(`pages/${id}`).catch(() => {
        throw new Error(t('errors.pageNotFound'));
      });
      database = await this.findChildDatabase(id) || await this.createTaskDatabase(id);
    }

    // Older lists may name their checkbox differently: use whichever checkbox exists.
    let doneProperty = Object.entries(database.properties || {})
      .find(([, property]) => property.type === 'checkbox')?.[0];
    if (!doneProperty) {
      await this.request(`databases/${database.id}`, 'PATCH', {
        properties: { [Property.DONE]: { checkbox: {} } },
      });
      doneProperty = Property.DONE;
    }

    return { databaseId: database.id.replace(/-/g, ''), doneProperty };
  }

  /**
   * @private
   * @param {string} pageId
   * @returns {Promise<object | null>} The "Salchi" database inside the page, if any.
   */
  async findChildDatabase(pageId) {
    const children = await this.request(`blocks/${pageId}/children?page_size=100`);
    const block = (children.results || []).find(
      (child) => child.type === 'child_database' && (child.child_database?.title || '').trim() === DATABASE_TITLE,
    );
    return block ? this.request(`databases/${block.id}`) : null;
  }

  /**
   * @private
   * @param {string} pageId
   * @returns {Promise<object>} A new task database created inside the page.
   */
  createTaskDatabase(pageId) {
    return this.request('databases', 'POST', {
      parent: { type: 'page_id', page_id: pageId },
      icon: { type: 'emoji', emoji: '🐕' },
      title: [{ type: 'text', text: { content: DATABASE_TITLE } }],
      properties: {
        [Property.TITLE]: { title: {} },
        [Property.DONE]: { checkbox: {} },
        [Property.DUE]: { date: {} },
        [Property.CALENDAR_LINK]: { url: {} },
      },
    });
  }

  /**
   * Adds the due-date and calendar-link columns to lists created before they existed.
   *
   * @param {string} databaseId
   */
  async ensureSchema(databaseId) {
    const database = await this.request(`databases/${databaseId}`);
    const properties = database.properties || {};
    const missing = {};
    if (!properties[Property.DUE]) missing[Property.DUE] = { date: {} };
    if (!properties[Property.CALENDAR_LINK]) missing[Property.CALENDAR_LINK] = { url: {} };
    if (Object.keys(missing).length) {
      await this.request(`databases/${databaseId}`, 'PATCH', { properties: missing });
    }
  }

  /**
   * Lists the tasks that are not done yet, dated ones first.
   *
   * @param {string} databaseId
   * @param {string} doneProperty - Name of the checkbox column.
   * @returns {Promise<Array<{ id: string, title: string, due: string | null, calendarUrl: string | null }>>}
   */
  async queryOpenTasks(databaseId, doneProperty) {
    const json = await this.request(`databases/${databaseId}/query`, 'POST', {
      filter: { property: doneProperty, checkbox: { equals: false } },
      sorts: [
        { property: Property.DUE, direction: 'ascending' },
        { timestamp: 'created_time', direction: 'ascending' },
      ],
      page_size: 100,
    });

    return (json.results || []).map((page) => {
      const properties = page.properties || {};
      const titleProperty = Object.values(properties).find((property) => property.type === 'title');
      const title = (titleProperty?.title || []).map((fragment) => fragment.plain_text).join('');
      return {
        id: page.id,
        title: title || t('list.untitled'),
        due: properties[Property.DUE]?.date?.start || null,
        calendarUrl: properties[Property.CALENDAR_LINK]?.url || null,
      };
    });
  }

  /**
   * @param {string} databaseId
   * @param {string} title
   * @param {string | null} due
   * @returns {Promise<string>} ID of the new page.
   */
  async createTask(databaseId, title, due) {
    // "title" is the internal ID of the title column, whatever its visible name is.
    const properties = { title: { title: [{ text: { content: title } }] } };
    if (due) properties[Property.DUE] = { date: { start: due } };
    const page = await this.request('pages', 'POST', { parent: { database_id: databaseId }, properties });
    return page.id;
  }

  /**
   * @param {string} pageId
   * @param {string | null} due - `null` clears the date.
   */
  setDue(pageId, due) {
    return this.request(`pages/${pageId}`, 'PATCH', {
      properties: { [Property.DUE]: { date: due ? { start: due } : null } },
    });
  }

  /**
   * @param {string} pageId
   * @param {string} doneProperty
   */
  markDone(pageId, doneProperty) {
    return this.request(`pages/${pageId}`, 'PATCH', {
      properties: { [doneProperty]: { checkbox: true } },
    });
  }
}

module.exports = { NotionClient, Property, extractNotionId };
