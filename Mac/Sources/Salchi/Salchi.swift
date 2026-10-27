import AppKit

/// Entry point.
///
/// Salchi is an "accessory" app: no Dock icon and no main menu, just the floating panel and
/// a menu-bar item. See `AppDelegate` for the setup.
@main
enum SalchiMain {
    @MainActor
    /// Starts the AppKit run loop with `AppDelegate`.
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        // NSApplication keeps only a weak reference to its delegate.
        withExtendedLifetime(delegate) { app.run() }
    }
}
