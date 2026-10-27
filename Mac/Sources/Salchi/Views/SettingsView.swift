import ServiceManagement
import SwiftUI

/// Settings panel shown inside the card: Notion connection (Notion edition only) and
/// "open at login".
struct SettingsView: View {
    @ObservedObject var store: TodoStore
    @ObservedObject var ui: UIState

    @State private var token = Keychain.load() ?? ""
    @State private var databaseLink = AppConfig.databaseID
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    /// Edition-specific section, "open at login" and the save button.
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if Edition.current == .notion {
                notionSection
            } else {
                Text("Ajustes").font(.system(size: 14, weight: .bold))
            }

            Toggle("Abrir al iniciar sesión", isOn: $launchAtLogin)
                .font(.system(size: 12))
                .onChange(of: launchAtLogin) { enabled in
                    if enabled {
                        try? SMAppService.mainApp.register()
                    } else {
                        try? SMAppService.mainApp.unregister()
                    }
                }

            if Edition.current == .local {
                Text("Tus tareas se guardan solo en este Mac, en Library/Application Support/Salchi.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Spacer()
                Button(Edition.current == .notion ? "Guardar" : "Listo", action: save)
                    .keyboardShortcut(.defaultAction)
            }
        }
    }

    /// Token and database fields, with short instructions.
    private var notionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Conectar con Notion").font(.system(size: 14, weight: .bold))
            Text("1. Crea una integración interna y copia su token.\n2. En tu lista de Salchi en Notion, ••• → Conexiones → añade la integración.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Link("Abrir integraciones de Notion ↗", destination: URL(string: "https://www.notion.so/profile/integrations")!)
                .font(.system(size: 11, weight: .semibold))
            SecureField("Token (ntn_…)", text: $token)
                .textFieldStyle(.roundedBorder)
            TextField("ID o enlace de la base de datos", text: $databaseLink)
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
