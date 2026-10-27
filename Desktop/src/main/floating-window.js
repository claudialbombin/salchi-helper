/**
 * @file The always-on-top window that shows the dachshund and, on hover, the task list.
 *
 * The window has two sizes: a small one for the dog and a bigger one for the list. It
 * grows towards the centre of the screen so it never ends up off-screen, and it can sit
 * flush against any screen edge while collapsed.
 *
 * Hover detection differs per platform:
 *   - Windows: the main process polls the cursor position, which is reliable even when the
 *     window is resized under the cursor (where DOM mouse events can be missed).
 *   - Linux: the global cursor position is not available under Wayland, so the renderer
 *     reports mouseenter/mouseleave instead (see `handleRendererHover`).
 */
'use strict';

const { BrowserWindow, Menu, screen, shell } = require('electron');
const { EventEmitter } = require('events');

const IS_LINUX = process.platform === 'linux';

const COLLAPSED_SIZE = { width: 140, height: 93 };
const EXPANDED_SIZE = { width: 310, height: 450 };

const HOVER_POLL_MS = 60;
const EXPAND_DELAY_MS = 200;   // avoids opening the list when the cursor just passes by
const COLLAPSE_DELAY_MS = 150;
const DRAG_FRAME_MS = 12;

/**
 * @fires FloatingWindow#ui-change - Expanded/pinned/settings state changed.
 * @fires FloatingWindow#expand - The list was opened by hovering.
 * @fires FloatingWindow#ready - The window is visible for the first time.
 */
class FloatingWindow extends EventEmitter {
  /**
   * @param {object} options
   * @param {import('./config').ConfigStore} options.config - Used to remember position and pin.
   * @param {string} options.preload - Absolute path of the preload script.
   * @param {string} options.page - Absolute path of the renderer HTML.
   * @param {string} options.icon - Absolute path of the window icon.
   */
  constructor({ config, preload, page, icon }) {
    super();
    /** @private */ this.config = config;
    /** @private */ this.options = { preload, page, icon };

    /** UI state mirrored to the renderer. */
    this.ui = {
      expanded: false,
      pinned: !!config.get('pinned'),
      settings: false,
      editing: false,
    };

    /** @private */ this.hovering = false;
    /** @private */ this.growLeft = false;
    /** @private */ this.growDown = false;
    /** @private */ this.expandTimer = null;
    /** @private */ this.collapseTimer = null;
    /** @private @type {{ dx: number, dy: number, width: number, height: number, timer: NodeJS.Timeout } | null} */
    this.drag = null;
    /** @private A native context menu is open; the list must not collapse under it. */
    this.menuOpen = false;
    /** @type {BrowserWindow | null} */
    this.window = null;
  }

  /**
   * Creates the BrowserWindow and starts watching the cursor.
   */
  create() {
    const origin = this.initialPosition();
    this.window = new BrowserWindow({
      x: origin.x,
      y: origin.y,
      ...COLLAPSED_SIZE,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      icon: this.options.icon,
      webPreferences: { preload: this.options.preload },
    });

    // 'screen-saver' keeps it above full-screen apps as well.
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setVisibleOnAllWorkspaces(true);
    this.window.loadFile(this.options.page);

    // Links never navigate inside Salchi: they open in the default browser.
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) shell.openExternal(url);
      return { action: 'deny' };
    });
    this.window.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    });

    this.window.once('ready-to-show', () => {
      this.window.showInactive();
      this.emit('ready');
    });

    this.window.on('blur', () => {
      if (this.menuOpen) return;
      this.ui.editing = false;
      setTimeout(() => this.maybeCollapse(), 0);
    });

    setInterval(() => this.pollHover(), HOVER_POLL_MS);
  }

  /**
   * Sends a message to the renderer if the window is still alive.
   *
   * @param {string} channel
   * @param {unknown} payload
   */
  send(channel, payload) {
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send(channel, payload);
  }

  /* ------------------------------------------------------------------ state */

  /**
   * Applies a partial UI update coming from the renderer.
   *
   * @param {{ editing?: boolean, pinned?: boolean, settings?: boolean }} patch
   */
  applyUiPatch(patch) {
    if (typeof patch.editing === 'boolean') this.ui.editing = patch.editing;

    if (typeof patch.pinned === 'boolean' && patch.pinned !== this.ui.pinned) {
      this.ui.pinned = patch.pinned;
      this.config.set('pinned', patch.pinned);
      if (patch.pinned) this.setExpanded(true);
    }

    if (typeof patch.settings === 'boolean') {
      this.ui.settings = patch.settings;
      if (patch.settings) this.setExpanded(true);
    }

    this.emit('ui-change');
    setTimeout(() => this.maybeCollapse(), 0);
  }

  /**
   * Opens the list straight on the settings panel.
   */
  openSettings() {
    this.window.showInactive();
    this.setExpanded(true);
    this.ui.settings = true;
    this.emit('ui-change');
  }

  /**
   * Hides or shows the whole window (tray menu / tray click).
   */
  toggleVisible() {
    if (this.window.isVisible()) this.window.hide();
    else this.window.showInactive();
  }

  /**
   * Switches between the dog and the list, resizing the window accordingly.
   *
   * @param {boolean} expanded
   */
  setExpanded(expanded) {
    if (this.ui.expanded === expanded || !this.window) return;
    const bounds = this.window.getBounds();

    if (expanded) {
      // Grow towards the centre of the screen.
      const area = screen.getDisplayMatching(bounds).workArea;
      this.growLeft = bounds.x + bounds.width / 2 > area.x + area.width / 2;
      this.growDown = bounds.y + bounds.height / 2 < area.y + area.height / 2;
    }

    this.ui.expanded = expanded;
    if (!expanded) this.ui.settings = false;
    this.emit('ui-change');

    this.window.setBounds(this.frameFor(expanded ? EXPANDED_SIZE : COLLAPSED_SIZE, bounds));
    if (!expanded && this.window.isFocused()) this.window.blur();
  }

  /**
   * Collapses the list unless something is keeping it open.
   */
  maybeCollapse() {
    const { pinned, editing, settings } = this.ui;
    if (this.hovering || pinned || editing || settings || this.drag || this.menuOpen) return;
    this.setExpanded(false);
  }

  /**
   * Shows a native context menu and keeps the list open while it is visible.
   *
   * @param {Electron.MenuItemConstructorOptions[]} template
   */
  popupMenu(template) {
    if (!this.window) return;
    this.menuOpen = true;
    Menu.buildFromTemplate(template).popup({
      window: this.window,
      callback: () => {
        this.menuOpen = false;
        setTimeout(() => this.maybeCollapse(), 300);
      },
    });
  }

  /* ------------------------------------------------------------------ hover */

  /**
   * Windows: compares the cursor with the window bounds on every tick.
   *
   * @private
   */
  pollHover() {
    if (IS_LINUX || !this.window || !this.window.isVisible() || this.drag) return;
    const cursor = screen.getCursorScreenPoint();
    const b = this.window.getBounds();
    const inside = cursor.x >= b.x && cursor.x < b.x + b.width && cursor.y >= b.y && cursor.y < b.y + b.height;
    if (inside !== this.hovering) this.onHoverChange(inside);
  }

  /**
   * Linux: hover reported by the renderer.
   *
   * @param {boolean} inside
   */
  handleRendererHover(inside) {
    if (IS_LINUX && !this.drag && inside !== this.hovering) this.onHoverChange(inside);
  }

  /**
   * @private
   * @param {boolean} inside
   */
  onHoverChange(inside) {
    this.hovering = inside;
    clearTimeout(this.expandTimer);
    clearTimeout(this.collapseTimer);

    if (inside) {
      if (this.ui.expanded) return;
      this.expandTimer = setTimeout(() => {
        if (!this.hovering || this.drag) return;
        this.setExpanded(true);
        this.emit('expand');
      }, EXPAND_DELAY_MS);
    } else {
      this.collapseTimer = setTimeout(() => this.maybeCollapse(), COLLAPSE_DELAY_MS);
    }
  }

  /* ------------------------------------------------------------------- drag */

  /**
   * Starts moving the window with the cursor. The window is frameless, so dragging is done
   * by hand instead of with `-webkit-app-region`, which would swallow hover events.
   */
  startDrag() {
    if (!this.window || this.drag) return;
    clearTimeout(this.expandTimer);
    const cursor = screen.getCursorScreenPoint();
    const b = this.window.getBounds();
    this.drag = { dx: cursor.x - b.x, dy: cursor.y - b.y, width: b.width, height: b.height, timer: null };
    this.drag.timer = setInterval(() => {
      const c = screen.getCursorScreenPoint();
      this.window.setBounds({ x: c.x - this.drag.dx, y: c.y - this.drag.dy, width: this.drag.width, height: this.drag.height });
    }, DRAG_FRAME_MS);
  }

  /**
   * Stops dragging and remembers where the dog was left.
   */
  endDrag() {
    if (!this.drag) return;
    clearInterval(this.drag.timer);
    this.drag = null;
    this.savePosition();
  }

  /* --------------------------------------------------------------- geometry */

  /**
   * Computes the window frame for a given size, anchored to the current one.
   * The collapsed dog may touch the screen edges; the list stays inside the work area
   * (i.e. clear of the taskbar/panels).
   *
   * @private
   * @param {{ width: number, height: number }} size
   * @param {Electron.Rectangle} from
   * @returns {Electron.Rectangle}
   */
  frameFor(size, from) {
    const display = screen.getDisplayMatching(from);
    const area = size === COLLAPSED_SIZE ? display.bounds : display.workArea;
    let x = this.growLeft ? from.x + from.width - size.width : from.x;
    let y = this.growDown ? from.y : from.y + from.height - size.height;
    x = Math.round(Math.min(Math.max(x, area.x), area.x + area.width - size.width));
    y = Math.round(Math.min(Math.max(y, area.y), area.y + area.height - size.height));
    return { x, y, ...size };
  }

  /**
   * @private
   */
  savePosition() {
    const bounds = this.window.getBounds();
    const collapsed = this.ui.expanded ? this.frameFor(COLLAPSED_SIZE, bounds) : bounds;
    this.config.set('pos', { x: collapsed.x, y: collapsed.y });
  }

  /**
   * Last saved position if it is still on a connected screen, otherwise the bottom-right
   * corner of the primary display.
   *
   * @private
   * @returns {{ x: number, y: number }}
   */
  initialPosition() {
    const saved = this.config.get('pos');
    if (saved) {
      const visible = screen.getAllDisplays().some(({ bounds: s }) =>
        saved.x >= s.x - 20 && saved.y >= s.y - 20 && saved.x < s.x + s.width && saved.y < s.y + s.height);
      if (visible) return saved;
    }
    const area = screen.getPrimaryDisplay().workArea;
    return { x: area.x + area.width - COLLAPSED_SIZE.width, y: area.y + area.height - COLLAPSED_SIZE.height };
  }
}

module.exports = { FloatingWindow };
