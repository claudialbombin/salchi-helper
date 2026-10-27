import AppKit
import SwiftUI

/// Borderless, non-activating panel that floats above other apps.
///
/// It can still become key so the text field accepts typing, but it never becomes the main
/// window, so the app the user is working in keeps its focus and menu bar.
final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Hosting view that reacts to the first click even when the panel is not key, so a single
/// click on a checkbox works instead of first "activating" the window.
final class ClickHostingView<Content: View>: NSHostingView<Content> {
    /// Lets the first click act immediately instead of only focusing the window.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// Moves the borderless window while the user drags the dog or the list header.
///
/// SwiftUI only reports drag deltas inside the view, which jump when the window itself
/// moves; using the global cursor position avoids that feedback loop.
@MainActor
final class WindowMover {
    weak var window: NSWindow?
    /// Called once when a drag starts (e.g. to cancel a pending expand).
    var onStart: (() -> Void)?
    /// Called when the drag ends (e.g. to save the position).
    var onEnd: (() -> Void)?
    private(set) var dragging = false

    private var startMouse = NSPoint.zero
    private var startOrigin = NSPoint.zero

    /// Call on every drag update.
    func changed() {
        guard let window else { return }
        let mouse = NSEvent.mouseLocation
        if !dragging {
            dragging = true
            startMouse = mouse
            startOrigin = window.frame.origin
            onStart?()
        }
        window.setFrameOrigin(NSPoint(
            x: startOrigin.x + mouse.x - startMouse.x,
            y: startOrigin.y + mouse.y - startMouse.y
        ))
    }

    /// Call when the drag gesture ends.
    func ended() {
        dragging = false
        onEnd?()
    }
}
