import Foundation

/// Stores tasks in a JSON file on this Mac (local edition).
///
/// The file lives in `~/Library/Application Support/Salchi/tasks.json` and has the same
/// layout as the Windows/Linux local edition:
/// `{ "pending": [...], "done": [...] }`. Ticked-off tasks are kept as a short history.
final class LocalBackend: TaskBackend {
    /// A task as written to disk.
    private struct StoredTask: Codable {
        var id: String
        var title: String
        var createdAt: Date
        /// Same string format as Notion (see `DueFormat`).
        var due: String?
        var completedAt: Date?
    }

    /// Whole contents of `tasks.json`.
    private struct TaskFile: Codable {
        var pending: [StoredTask] = []
        var done: [StoredTask] = []
    }

    /// How many completed tasks are kept in the history.
    private static let historyLimit = 500

    private let fileURL: URL
    /// Calls may come from several concurrent tasks; the lock keeps reads and writes atomic.
    private let lock = NSLock()

    var storageKey: String { "local" }
    var refreshInterval: TimeInterval? { nil }
    var supportsDelete: Bool { true }

    /// Uses the standard Application Support folder of the current user.
    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        fileURL = support.appendingPathComponent("Salchi", isDirectory: true).appendingPathComponent("tasks.json")
    }

    /// Makes sure the folder for `tasks.json` exists.
    func prepare() async throws {
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    }

    /// Returns the pending tasks in the order they were added.
    func fetchOpen() async throws -> [TodoItem] {
        locked { () -> [TodoItem] in
            readFile().pending.map { stored in
                TodoItem(id: stored.id, title: stored.title, due: stored.due.flatMap(DueFormat.parse))
            }
        }
    }

    /// Appends a task and returns its new ID.
    func create(_ title: String, due: DueDate?) async throws -> String {
        try locked { () throws -> String in
            var file = readFile()
            let id = UUID().uuidString.lowercased()
            file.pending.append(StoredTask(id: id, title: title, createdAt: Date(), due: due.map(DueFormat.notion)))
            try writeFile(file)
            return id
        }
    }

    /// Changes or removes the due date of a pending task.
    func setDue(_ id: String, _ due: DueDate?) async throws {
        try update { file in
            if let index = file.pending.firstIndex(where: { $0.id == id }) {
                file.pending[index].due = due.map(DueFormat.notion)
            }
        }
    }

    /// Moves the task to the history, stamped with the completion time.
    func markDone(_ id: String) async throws {
        try update { file in
            guard let index = file.pending.firstIndex(where: { $0.id == id }) else { return }
            var task = file.pending.remove(at: index)
            task.completedAt = Date()
            file.done.append(task)
            file.done = Array(file.done.suffix(Self.historyLimit))
        }
    }

    /// Removes the task for good (it does not go to the history).
    func delete(_ id: String) async throws {
        try update { file in file.pending.removeAll { $0.id == id } }
    }

    // MARK: - File access

    /// Runs `body` while holding the lock.
    private func locked<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }

    /// Reads, modifies and writes the file as one atomic step.
    private func update(_ change: (inout TaskFile) -> Void) throws {
        try locked { () throws -> Void in
            var file = readFile()
            change(&file)
            try writeFile(file)
        }
    }

    /// A missing or unreadable file simply means "no tasks yet".
    private func readFile() -> TaskFile {
        guard let data = try? Data(contentsOf: fileURL) else { return TaskFile() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(TaskFile.self, from: data)) ?? TaskFile()
    }

    /// Writes atomically, so a crash never leaves a half-written file behind.
    private func writeFile(_ file: TaskFile) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(file).write(to: fileURL, options: .atomic)
    }
}
