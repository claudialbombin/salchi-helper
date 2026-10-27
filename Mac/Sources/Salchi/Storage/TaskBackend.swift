import Foundation

/// Where tasks are stored.
///
/// `TodoStore` only talks to this protocol, so the interface is identical in both editions:
/// `NotionBackend` for the Notion edition and `LocalBackend` for the local one.
protocol TaskBackend {
    /// Identifies the current storage target. When it changes (e.g. another Notion list is
    /// configured), `prepare()` runs again.
    var storageKey: String { get }

    /// How often the list should be reloaded in the background, or `nil` if it can only
    /// change from this app.
    var refreshInterval: TimeInterval? { get }

    /// Whether tasks can be deleted from Salchi (the Notion edition leaves that to Notion).
    var supportsDelete: Bool { get }

    /// One-off setup before the first load, such as adding missing columns.
    func prepare() async throws

    /// - Returns: The tasks that are not done yet.
    func fetchOpen() async throws -> [TodoItem]

    /// - Returns: The ID of the new task.
    func create(_ title: String, due: DueDate?) async throws -> String

    /// Changes or (with `nil`) removes the due date of a task.
    func setDue(_ id: String, _ due: DueDate?) async throws

    /// Marks a task as completed.
    func markDone(_ id: String) async throws

    /// Deletes a task permanently.
    func delete(_ id: String) async throws
}

/// Errors shown to the user. Messages are in Spanish because they appear in the UI as-is.
enum TaskBackendError: LocalizedError {
    case missingToken
    case api(String)

    var errorDescription: String? {
        switch self {
        case .missingToken: return "Falta conectar Notion: abre ⚙︎ ajustes."
        case .api(let message): return message
        }
    }
}
