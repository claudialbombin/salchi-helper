import Combine
import Foundation

/// Window state shared between the SwiftUI views and the `AppDelegate`.
@MainActor
final class UIState: ObservableObject {
    /// Showing the task list (true) or just the dog (false).
    @Published var expanded = false
    /// Keep the list open even when the cursor leaves it.
    @Published var pinned = false
    @Published var showSettings = false
    /// Something is half-done (typing, picking a date), so the list must not collapse.
    var editing = false
}
