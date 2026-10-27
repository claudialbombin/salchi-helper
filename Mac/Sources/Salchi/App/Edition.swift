import Foundation

/// Which flavour of Salchi this build is.
///
/// Both editions are built from the same sources. `build_app.sh` writes the edition into the
/// app's `Info.plist` (key `SalchiEdition`), so the choice is made when packaging, not at runtime.
enum Edition: String {
    /// Tasks live in a Notion database, shared with other devices and the Notion apps.
    case notion
    /// Tasks live in a JSON file on this Mac. No account needed.
    case local

    /// Edition of the running app. Falls back to `.notion` when the key is missing
    /// (for example when running with `swift run` during development).
    static let current: Edition = {
        let value = Bundle.main.object(forInfoDictionaryKey: "SalchiEdition") as? String
        return Edition(rawValue: value ?? "") ?? .notion
    }()
}
