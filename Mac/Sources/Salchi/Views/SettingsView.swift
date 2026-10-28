import ServiceManagement
import SwiftUI

/// Settings panel shown inside the card: Notion connection (Notion edition only), language
/// and "open at login".
struct SettingsView: View {
    @ObservedObject var store: TodoStore
    @ObservedObject var ui: UIState
    @ObservedObject private var l10n = L10n.shared

    @State private var token = Keychain.load() ?? ""
    @State private var databaseLink = AppConfig.databaseID
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    /// Edition-specific section, language, "open at login" and the save button.
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if Edition.current == .notion {
                notionSection
            } else {
                Text(tr("settings.title")).font(.system(size: 14, weight: .bold))
            }

            // Changes apply at once: the whole interface redraws in the new language.
            Picker(tr("settings.language"), selection: Binding(get: { l10n.language }, set: { l10n.choose($0) })) {
                ForEach(l10n.languages) { language in
                    Text(language.name).tag(language.code)
                }
            }
            .font(.system(size: 12))

            Toggle(tr("settings.autostart"), isOn: $launchAtLogin)
                .font(.system(size: 12))
                .onChange(of: launchAtLogin) { enabled in
                    if enabled {
                        try? SMAppService.mainApp.register()
                    } else {
                        try? SMAppService.mainApp.unregister()
                    }
                }

            if Edition.current == .local {
                Text(tr("settings.macLocalNote", ["path": "Library/Application Support/Salchi"]))
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Spacer()
                Button(Edition.current == .notion ? tr("settings.save") : tr("picker.confirm"), action: save)
                    .keyboardShortcut(.defaultAction)
            }
        }
    }

    /// Token and database fields, with short instructions.
    private var notionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("settings.connectNotion")).font(.system(size: 14, weight: .bold))
            Text(tr("settings.macNotionSteps"))
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Link("notion.so/profile/integrations ↗", destination: URL(string: "https://www.notion.so/profile/integrations")!)
                .font(.system(size: 11, weight: .semibold))
            SecureField(tr("settings.tokenPlaceholder"), text: $token)
                .textFieldStyle(.roundedBorder)
            TextField(tr("settings.macDatabasePlaceholder"), text: $databaseLink)
                .textFieldStyle(.roundedBorder)
        }
    }

    /// Stores the token and database, closes the panel and reloads the list.
    private func save() {
        if Edition.current == .notion {
            let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { Keychain.save(trimmed) }
            if let id = NotionID.extract(from: databaseLink) {
                AppConfig.databaseID = id
                databaseLink = id
            }
        }
        ui.showSettings = false
        store.refresh()
    }
}
