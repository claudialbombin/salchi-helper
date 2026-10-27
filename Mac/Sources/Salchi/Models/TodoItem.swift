import Foundation

/// A task as shown in the list.
struct TodoItem: Identifiable, Equatable {
    /// Notion page ID, a local ID, or a temporary `pending-…` ID while it is being saved.
    let id: String
    var title: String
    var due: DueDate? = nil
    /// Link to the Google Calendar event, filled in by the Google Apps Script (Notion edition).
    var calendarURL: String? = nil

    /// Whether the task is still being saved and therefore cannot be edited yet.
    var isPending: Bool { id.hasPrefix(TodoItem.pendingPrefix) }

    /// Prefix of temporary IDs used for optimistic inserts.
    static let pendingPrefix = "pending-"
}
