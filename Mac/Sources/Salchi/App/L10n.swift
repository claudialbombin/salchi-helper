import Foundation
import SwiftUI

/// One language Salchi speaks, as listed in `locales/languages.json`.
struct AppLanguage: Decodable, Identifiable, Hashable {
    /// Code such as `es`, `en-GB` or `zh-Hans`.
    let code: String
    /// The language's name written in that language ("Français", "日本語"…).
    let name: String
    /// `ltr`, or `rtl` for Arabic, Hebrew, Persian and Urdu.
    let dir: String

    var id: String { code }
}

/// Translations for the Mac app.
///
/// The strings live in the repository's top-level `locales` folder, one JSON file per language,
/// shared with the Windows and Linux app. `build_app.sh` copies that folder into
/// `Contents/Resources/locales`. The chosen language is saved in `UserDefaults`; until the user
/// picks one, Salchi shows a language chooser and speaks the closest match to the system.
final class L10n: ObservableObject {
    static let shared = L10n()

    /// Used whenever a string or a whole language is missing.
    static let fallback = "en-US"

    private static let defaultsKey = "language"

    /// Every language Salchi speaks, in the order of `languages.json`.
    let languages: [AppLanguage]

    /// The current language code.
    @Published private(set) var language: String

    /// Whether the user has picked a language yet (if not, the chooser is shown).
    @Published private(set) var hasChosen: Bool

    private var strings: [String: String] = [:]
    private var fallbackStrings: [String: String] = [:]
    private let directory: URL?

    private init() {
        // Work on locals first: `self` cannot be read until every stored property is set.
        let directory = L10n.findDirectory()
        let languages = L10n.loadLanguages(from: directory)
        let codes = Set(languages.map(\.code))
        let saved = UserDefaults.standard.string(forKey: L10n.defaultsKey)
        let chosen = saved.map { codes.contains($0) } ?? false
        let language = chosen ? saved! : L10n.bestMatch(for: Locale.preferredLanguages, among: codes)

        self.directory = directory
        self.languages = languages
        self.language = language
        self.hasChosen = chosen
        self.fallbackStrings = L10n.loadStrings(L10n.fallback, from: directory)
        self.strings = L10n.loadStrings(language, from: directory)
    }

    /// Switches language, remembers it and redraws everything that observes this object.
    func choose(_ code: String) {
        guard languages.contains(where: { $0.code == code }) else { return }
        UserDefaults.standard.set(code, forKey: L10n.defaultsKey)
        strings = L10n.loadStrings(code, from: directory)
        language = code
        hasChosen = true
    }

    /// Translates `key`, filling `{placeholders}` from `params`.
    func t(_ key: String, _ params: [String: String] = [:]) -> String {
        var text = strings[key] ?? fallbackStrings[key] ?? key
        for (name, value) in params {
            text = text.replacingOccurrences(of: "{\(name)}", with: value)
        }
        return text
    }

    /// Locale for dates, weekdays and the time format (24-hour clock or AM/PM).
    var locale: Locale {
        Locale(identifier: language)
    }

    /// Gregorian calendar whose weeks start on the language's usual first day.
    var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = locale
        calendar.timeZone = .current
        return calendar
    }

    /// Mirrors the interface for right-to-left languages.
    var layoutDirection: LayoutDirection {
        languages.first { $0.code == language }?.dir == "rtl" ? .rightToLeft : .leftToRight
    }

    // MARK: - Loading

    /// The bundled `locales` folder, or the repository's one when running with `swift run`.
    private static func findDirectory() -> URL? {
        if let bundled = Bundle.main.resourceURL?.appendingPathComponent("locales"),
           FileManager.default.fileExists(atPath: bundled.appendingPathComponent("languages.json").path) {
            return bundled
        }
        // Sources/Salchi/App/L10n.swift → repository root.
        let repository = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let development = repository.appendingPathComponent("locales")
        return FileManager.default.fileExists(atPath: development.path) ? development : nil
    }

    private static func loadLanguages(from directory: URL?) -> [AppLanguage] {
        struct File: Decodable { let languages: [AppLanguage] }
        guard let directory,
              let data = try? Data(contentsOf: directory.appendingPathComponent("languages.json")),
              let file = try? JSONDecoder().decode(File.self, from: data) else {
            return [AppLanguage(code: fallback, name: "English (US)", dir: "ltr")]
        }
        return file.languages
    }

    private static func loadStrings(_ code: String, from directory: URL?) -> [String: String] {
        guard let directory,
              let data = try? Data(contentsOf: directory.appendingPathComponent("\(code).json")),
              let table = try? JSONDecoder().decode([String: String].self, from: data) else {
            return [:]
        }
        return table
    }

    /// Maps the system's preferred languages (e.g. "es-MX", "zh-Hant-TW", "nn-NO") to the
    /// closest language Salchi speaks, or English.
    static func bestMatch(for preferred: [String], among codes: Set<String>) -> String {
        for identifier in preferred {
            let tag = identifier.replacingOccurrences(of: "_", with: "-")
            if let exact = codes.first(where: { $0.lowercased() == tag.lowercased() }) { return exact }

            let parts = tag.lowercased().split(separator: "-").map(String.init)
            guard let language = parts.first else { continue }
            let region = parts.dropFirst().first { $0.count == 2 } ?? ""
            let script = parts.dropFirst().first { $0.count == 4 } ?? ""

            switch language {
            case "en":
                return ["gb", "ie", "au", "nz", "za", "in", "mt"].contains(region) ? "en-GB" : "en-US"
            case "pt":
                return !region.isEmpty && region != "br" ? "pt-PT" : "pt-BR"
            case "zh":
                return script == "hant" || ["tw", "hk", "mo"].contains(region) ? "zh-Hant" : "zh-Hans"
            case "no", "nn":
                return "nb"
            default:
                if codes.contains(language) { return language }
            }
        }
        return fallback
    }
}

/// Shorthand for `L10n.shared.t`, used throughout the views.
func tr(_ key: String, _ params: [String: String] = [:]) -> String {
    L10n.shared.t(key, params)
}
