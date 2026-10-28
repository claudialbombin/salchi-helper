import AppKit
import Combine
import SwiftUI

/// Creates the floating panel and the menu-bar item, and handles hover, resizing and
/// positioning of the panel.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    let store = TodoStore(backend: AppDelegate.makeBackend())
    let ui = UIState()
    let mover = WindowMover()

    private var panel: FloatingPanel!
    private var statusItem: NSStatusItem!
    private var subscriptions = Set<AnyCancellable>()

    private var hovering = false
    private var expandTask: Task<Void, Never>?
    private var collapseTask: Task<Void, Never>?
    private var hoverPollTask: Task<Void, Never>?
    /// Direction the card grows in, chosen so it stays on screen.
    private var growLeft = false
    private var growDown = false

    static let collapsedSize = NSSize(width: 140, height: 93)
    static let expandedSize = NSSize(width: 310, height: 440)

    /// Delays that make hovering feel calm rather than jumpy.
    private enum Timing {
        static let hoverPoll: UInt64 = 60_000_000
        static let expandDelay: UInt64 = 200_000_000
        static let collapseDelay: UInt64 = 150_000_000
    }

    /// Builds the panel and menu-bar item, starts loading tasks and watching the cursor.
    func applicationDidFinishLaunching(_ notification: Notification) {
        ui.pinned = AppConfig.pinned
        createPanel()
        observeState()
        setUpStatusItem()

        panel.orderFrontRegardless()
        store.start()

        if !L10n.shared.hasChosen {
            ui.expanded = true // first start: the card opens on the language chooser
        } else if Edition.current == .notion && Keychain.load() == nil {
            openSettings()
        } else if ui.pinned {
            ui.expanded = true
        }

        // The cursor is polled rather than tracked with NSTrackingArea: tracking areas miss
        // the "exit" event when the window is resized under the cursor.
        hoverPollTask = Task { [weak self] in
            while !Task.isCancelled {
                self?.pollHover()
                try? await Task.sleep(nanoseconds: Timing.hoverPoll)
            }
        }
    }

    // MARK: - Setup

    /// Storage for the edition this app was built as.
    nonisolated private static func makeBackend() -> any TaskBackend {
        switch Edition.current {
        case .notion: return NotionBackend()
        case .local: return LocalBackend()
        }
    }

    /// Creates the transparent floating panel that hosts the SwiftUI views.
    private func createPanel() {
        panel = FloatingPanel(
            contentRect: NSRect(origin: savedOrigin(), size: Self.collapsedSize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.delegate = self

        let host = ClickHostingView(rootView: RootView(store: store, ui: ui, mover: mover))
        host.sizingOptions = [] // the panel is resized by hand, not by SwiftUI
        panel.contentView = host

        mover.window = panel
        mover.onStart = { [weak self] in self?.expandTask?.cancel() }
        mover.onEnd = { [weak self] in self?.savePosition() }
    }

    /// Reacts to UI changes made from SwiftUI.
    private func observeState() {
        ui.$expanded.removeDuplicates().dropFirst()
            .sink { [weak self] expanded in self?.resize(expanded: expanded) }
            .store(in: &subscriptions)

        ui.$pinned.dropFirst()
            .sink { [weak self] pinned in
                AppConfig.pinned = pinned
                guard let self else { return }
                if pinned {
                    self.ui.expanded = true
                } else {
                    DispatchQueue.main.async { self.maybeCollapse() }
                }
            }
            .store(in: &subscriptions)

        ui.$showSettings.dropFirst()
            .sink { [weak self] showing in
                if !showing { DispatchQueue.main.async { self?.maybeCollapse() } }
            }
            .store(in: &subscriptions)

        store.$items
            .sink { [weak self] items in
                self?.statusItem?.button?.title = items.isEmpty ? "🐕" : "🐕 \(items.count)"
            }
            .store(in: &subscriptions)

        L10n.shared.$language.dropFirst()
            .sink { [weak self] _ in DispatchQueue.main.async { self?.buildMenu() } }
            .store(in: &subscriptions)

        // Once the first-run language is chosen, carry on with the usual start-up.
        L10n.shared.$hasChosen.removeDuplicates().dropFirst()
            .filter { $0 }
            .sink { [weak self] _ in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if Edition.current == .notion && Keychain.load() == nil {
                        self.openSettings()
                    } else {
                        self.maybeCollapse()
                    }
                }
            }
            .store(in: &subscriptions)
    }

    /// Menu-bar item showing the task count, with a small menu.
    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "🐕"
        buildMenu()
    }

    /// (Re)builds the menu-bar menu in the current language.
    private func buildMenu() {
        let menu = NSMenu()
        menu.addItem(menuItem(tr("tray.toggle"), #selector(toggleVisible), key: "t"))
        menu.addItem(menuItem(tr("header.reload"), #selector(reload), key: "r"))
        menu.addItem(menuItem(tr("tray.settings"), #selector(openSettings), key: ","))
        if Edition.current == .notion {
            menu.addItem(menuItem(tr("tray.openList"), #selector(openNotion), key: ""))
        }
        menu.addItem(.separator())
        menu.addItem(menuItem(tr("tray.quit"), #selector(quit), key: "q"))
        statusItem.menu = menu
    }

    /// Menu item targeting this delegate.
    private func menuItem(_ title: String, _ action: Selector, key: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    // MARK: - Hover

    /// Checks whether the cursor is over the panel.
    private func pollHover() {
        guard let panel, panel.isVisible, !mover.dragging else { return }
        let inside = panel.frame.contains(NSEvent.mouseLocation)
        if inside != hovering { hoverChanged(inside) }
    }

    /// Expands shortly after the cursor enters, collapses shortly after it leaves.
    private func hoverChanged(_ inside: Bool) {
        hovering = inside
        expandTask?.cancel()
        collapseTask?.cancel()

        if inside {
            guard !ui.expanded else { return }
            expandTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: Timing.expandDelay)
                guard !Task.isCancelled, let self, self.hovering, !self.mover.dragging else { return }
                self.ui.expanded = true
                self.store.refreshIfStale()
            }
        } else {
            collapseTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: Timing.collapseDelay)
                guard !Task.isCancelled else { return }
                self?.maybeCollapse()
            }
        }
    }

    /// Collapses the card unless something is keeping it open.
    private func maybeCollapse() {
        guard !hovering, !ui.pinned, !ui.editing, !ui.showSettings, !mover.dragging, L10n.shared.hasChosen else { return }
        if ui.expanded { ui.expanded = false }
    }

    /// Clicking another app counts as "done here".
    func windowDidResignKey(_ notification: Notification) {
        ui.editing = false
        maybeCollapse()
    }

    // MARK: - Geometry

    private var screenFrame: NSRect {
        (panel.screen ?? NSScreen.main)?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
    }

    /// Screen area without the menu bar and the Dock.
    private var visibleFrame: NSRect {
        (panel.screen ?? NSScreen.main)?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
    }

    /// Frame for a given size, anchored on the current one and clamped to the screen.
    /// The dog may sit flush against any edge; the card stays clear of the Dock and menu bar.
    private func frame(for size: NSSize, from current: NSRect) -> NSRect {
        let bounds = size == Self.collapsedSize ? screenFrame : visibleFrame
        var x = growLeft ? current.maxX - size.width : current.minX
        var y = growDown ? current.maxY - size.height : current.minY
        x = min(max(x, bounds.minX), bounds.maxX - size.width)
        y = min(max(y, bounds.minY), bounds.maxY - size.height)
        return NSRect(x: x, y: y, width: size.width, height: size.height)
    }

    /// Switches the panel between the dog size and the card size.
    private func resize(expanded: Bool) {
        let current = panel.frame
        if expanded {
            // Grow towards the centre of the screen.
            growLeft = current.midX > visibleFrame.midX
            growDown = current.midY > visibleFrame.midY
        }
        panel.setFrame(frame(for: expanded ? Self.expandedSize : Self.collapsedSize, from: current), display: true)
    }

    /// Remembers where the dog was left, in collapsed coordinates.
    private func savePosition() {
        let collapsed = ui.expanded ? frame(for: Self.collapsedSize, from: panel.frame) : panel.frame
        AppConfig.windowOrigin = collapsed.origin
    }

    /// Last saved position if it is still on a connected screen, otherwise the bottom-right
    /// corner of the main screen.
    private func savedOrigin() -> NSPoint {
        if let saved = AppConfig.windowOrigin,
           NSScreen.screens.contains(where: { $0.frame.insetBy(dx: -20, dy: -20).contains(saved) }) {
            return saved
        }
        let visible = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        return NSPoint(x: visible.maxX - Self.collapsedSize.width, y: visible.minY)
    }

    // MARK: - Menu actions

    /// Hides or shows the panel.
    @objc private func toggleVisible() {
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.orderFrontRegardless()
        }
    }

    /// Reloads the task list.
    @objc private func reload() {
        store.refresh()
    }

    /// Shows the card on its settings panel.
    @objc private func openSettings() {
        panel.orderFrontRegardless()
        ui.expanded = true
        ui.showSettings = true
    }

    /// Opens the task database in the browser.
    @objc private func openNotion() {
        if let url = URL(string: "https://www.notion.so/\(AppConfig.databaseID)") {
            NSWorkspace.shared.open(url)
        }
    }

    /// Quits Salchi.
    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
