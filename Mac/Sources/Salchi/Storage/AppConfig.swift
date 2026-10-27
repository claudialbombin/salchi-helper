import Foundation

/// Small settings kept in `UserDefaults`.
///
/// The key names are kept from version 1.0 so existing installs keep their settings.
enum AppConfig {
    /// Notion database used when none has been configured yet (the author's own list).
    static let defaultDatabaseID = "0a2f0c64d4544602b374bbad511803cd"

    /// `UserDefaults` keys.
    private enum Key {
        static let databaseID = "databaseID"
        static let pinned = "pinned"
        static let positionX = "posX"
        static let positionY = "posY"
    }

    /// ID of the Notion database that holds the tasks.
    static var databaseID: String {
        get { UserDefaults.standard.string(forKey: Key.databaseID) ?? defaultDatabaseID }
        set { UserDefaults.standard.set(newValue, forKey: Key.databaseID) }
    }

    /// Whether the list stays open when the cursor leaves it.
    static var pinned: Bool {
        get { UserDefaults.standard.bool(forKey: Key.pinned) }
        set { UserDefaults.standard.set(newValue, forKey: Key.pinned) }
    }

    /// Last position of the collapsed window (bottom-left corner, in screen coordinates).
    static var windowOrigin: NSPoint? {
        get {
            let defaults = UserDefaults.standard
            guard defaults.object(forKey: Key.positionX) != nil else { return nil }
            return NSPoint(x: defaults.double(forKey: Key.positionX), y: defaults.double(forKey: Key.positionY))
        }
        set {
            guard let point = newValue else { return }
            UserDefaults.standard.set(Double(point.x), forKey: Key.positionX)
            UserDefaults.standard.set(Double(point.y), forKey: Key.positionY)
        }
    }
}
