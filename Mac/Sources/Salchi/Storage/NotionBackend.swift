import Foundation

/// Stores tasks in a Notion database through the REST API (Notion edition).
///
/// API reference: https://developers.notion.com/reference
struct NotionBackend: TaskBackend {
    /// Column names in the Notion database. They are visible to the user in Notion, so they
    /// are kept in Spanish like the rest of the workspace.
    enum Property {
        static let done = "Hecho"
        static let due = "Fecha"
        static let calendarLink = "Calendario"
    }

    private static let apiBase = "https://api.notion.com/v1/"
    private static let apiVersion = "2022-06-28"

    var storageKey: String { AppConfig.databaseID }
    var refreshInterval: TimeInterval? { 20 }
    var supportsDelete: Bool { false }

    /// Adds the due-date and calendar-link columns to lists created before they existed.
    func prepare() async throws {
        let database = try await request("databases/\(AppConfig.databaseID)", method: "GET")
        let properties = database["properties"] as? [String: Any] ?? [:]

        var missing: [String: Any] = [:]
        if properties[Property.due] == nil { missing[Property.due] = ["date": [String: Any]()] }
        if properties[Property.calendarLink] == nil { missing[Property.calendarLink] = ["url": [String: Any]()] }
        if !missing.isEmpty {
            _ = try await request("databases/\(AppConfig.databaseID)", method: "PATCH", body: ["properties": missing])
        }
    }

    /// Queries the tasks whose checkbox is not ticked, dated ones first.
    func fetchOpen() async throws -> [TodoItem] {
        let json = try await request("databases/\(AppConfig.databaseID)/query", method: "POST", body: [
            "filter": ["property": Property.done, "checkbox": ["equals": false]],
            "sorts": [
                ["property": Property.due, "direction": "ascending"],
                ["timestamp": "created_time", "direction": "ascending"],
            ],
            "page_size": 100,
        ])

        let pages = json["results"] as? [[String: Any]] ?? []
        return pages.compactMap { page in
            guard let id = page["id"] as? String, let properties = page["properties"] as? [String: Any] else { return nil }
            return TodoItem(
                id: id,
                title: Self.title(of: properties),
                due: Self.dueDate(of: properties),
                calendarURL: (properties[Property.calendarLink] as? [String: Any])?["url"] as? String
            )
        }
    }

    /// Creates a page in the database and returns its ID.
    func create(_ title: String, due: DueDate?) async throws -> String {
        // "title" is the internal ID of the title column, whatever its visible name is.
        var properties: [String: Any] = ["title": ["title": [["text": ["content": title]]]]]
        if let due { properties[Property.due] = ["date": ["start": DueFormat.notion(due)]] }

        let page = try await request("pages", method: "POST", body: [
            "parent": ["database_id": AppConfig.databaseID],
            "properties": properties,
        ])
        guard let id = page["id"] as? String else { throw TaskBackendError.api(tr("errors.createFailed")) }
        return id
    }

    /// Writes the due date, or clears it when `due` is `nil`.
    func setDue(_ id: String, _ due: DueDate?) async throws {
        // Notion clears a date property when it receives `null`.
        let value: Any = due.map { ["start": DueFormat.notion($0)] as Any } ?? NSNull()
        _ = try await request("pages/\(id)", method: "PATCH", body: ["properties": [Property.due: ["date": value]]])
    }

    /// Ticks the "done" checkbox of the page.
    func markDone(_ id: String) async throws {
        _ = try await request("pages/\(id)", method: "PATCH", body: ["properties": [Property.done: ["checkbox": true]]])
    }

    /// Moves the page to Notion's trash (not exposed in the UI of this edition).
    func delete(_ id: String) async throws {
        _ = try await request("pages/\(id)", method: "PATCH", body: ["archived": true])
    }

    // MARK: - Helpers

    /// Performs an authenticated request and returns the decoded JSON object.
    private func request(_ path: String, method: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let token = Keychain.load() else { throw TaskBackendError.missingToken }
        guard let url = URL(string: Self.apiBase + path) else { throw TaskBackendError.api(tr("errors.badAddress")) }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(Self.apiVersion, forHTTPHeaderField: "Notion-Version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }

        let (data, response) = try await URLSession.shared.data(for: request)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw TaskBackendError.api((json["message"] as? String) ?? tr("errors.notResponding"))
        }
        return json
    }

    /// Plain text of the page's title column, whatever that column is called.
    private static func title(of properties: [String: Any]) -> String {
        let titleProperty = properties.values
            .compactMap { $0 as? [String: Any] }
            .first { ($0["type"] as? String) == "title" }
        let fragments = titleProperty?["title"] as? [[String: Any]] ?? []
        let text = fragments.compactMap { $0["plain_text"] as? String }.joined()
        return text.isEmpty ? tr("list.untitled") : text
    }

    /// The due date, if the page has one. An empty date property comes back as `null`.
    private static func dueDate(of properties: [String: Any]) -> DueDate? {
        guard let property = properties[Property.due] as? [String: Any],
              let date = property["date"] as? [String: Any],
              let start = date["start"] as? String
        else { return nil }
        return DueFormat.parse(start)
    }
}

/// Parsing of Notion IDs pasted by the user.
enum NotionID {
    /// Extracts the 32-character ID from an ID or any Notion URL
    /// (`notion.so/Title-<id>`, `app.notion.com/p/<id>`, dashed UUIDs, `?pvs=` suffixes…).
    static func extract(from raw: String) -> String? {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutQuery = text.components(separatedBy: "?").first ?? text
        let lastSegment = withoutQuery.split(separator: "/").last.map(String.init) ?? withoutQuery
        let isID: (String) -> Bool = { $0.count == 32 && $0.allSatisfy { $0.isHexDigit } }

        let undashed = lastSegment.replacingOccurrences(of: "-", with: "")
        if isID(undashed) { return undashed.lowercased() }

        // "My-Page-Title-0123…" → the ID is the last dash-separated chunk.
        if let tail = lastSegment.split(separator: "-").last.map(String.init), isID(tail) {
            return tail.lowercased()
        }
        return nil
    }
}
