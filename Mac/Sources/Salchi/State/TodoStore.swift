import Combine
import Foundation
import SwiftUI

/// Owns the list of open tasks and keeps it in sync with the storage backend.
///
/// Changes are optimistic: the list updates immediately and the backend is updated in the
/// background. If the backend refuses a change, the list is reloaded so it never stays wrong.
@MainActor
final class TodoStore: ObservableObject {
    /// Open tasks, sorted for display.
    @Published var items: [TodoItem] = []
    /// Tasks being ticked off; they stay visible, struck through, for a moment.
    @Published var completing: Set<String> = []
    /// Last error, shown at the top of the list and as a red badge on the dog.
    @Published var error: String?
    @Published var loading = false

    private let backend: any TaskBackend
    private var pollTask: Task<Void, Never>?
    private var lastLoad = Date.distantPast
    /// Storage key for which `prepare()` has already run during this session.
    private var preparedKey: String?

    /// How long a ticked task stays visible before leaving the list.
    private static let completeAnimation: UInt64 = 450_000_000

    /// - Parameter backend: Where tasks are read from and written to.
    init(backend: any TaskBackend) {
        self.backend = backend
    }

    /// Whether the current edition lets the user delete tasks.
    var canDelete: Bool { backend.supportsDelete }

    /// Loads the list now and, for remote backends, keeps reloading it in the background.
    func start() {
        pollTask?.cancel()
        let interval = backend.refreshInterval
        pollTask = Task { [weak self] in
            await self?.load()
            guard let interval else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                await self?.load()
            }
        }
    }

    /// Reloads the list in the background.
    func refresh() {
        Task { await load() }
    }

    /// Reloads only if the list is more than a few seconds old (used when the list opens).
    func refreshIfStale() {
        if Date().timeIntervalSince(lastLoad) > 5 { refresh() }
    }

    /// Fetches the open tasks. Tasks still being created are kept at the end.
    func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }

        do {
            if preparedKey != backend.storageKey {
                try await backend.prepare()
                preparedKey = backend.storageKey
            }
            let fetched = try await backend.fetchOpen()
            let pending = items.filter(\.isPending)
            withAnimation(.easeInOut(duration: 0.2)) {
                items = Self.sorted(fetched.filter { !completing.contains($0.id) } + pending)
            }
            error = nil
            lastLoad = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Adds a task. It appears at once (dimmed) and is confirmed when the backend replies.
    func add(_ title: String, due: DueDate? = nil) {
        let placeholder = TodoItem(id: TodoItem.pendingPrefix + UUID().uuidString, title: title, due: due)
        withAnimation { items = Self.sorted(items + [placeholder]) }

        Task {
            do {
                let id = try await backend.create(title, due: due)
                // A background refresh may have brought the new task in already.
                if items.contains(where: { $0.id == id }) {
                    items.removeAll { $0.id == placeholder.id }
                } else if let index = items.firstIndex(where: { $0.id == placeholder.id }) {
                    items[index] = TodoItem(id: id, title: title, due: due)
                }
            } catch {
                items.removeAll { $0.id == placeholder.id }
                self.error = error.localizedDescription
            }
        }
    }

    /// Changes or (with `nil`) removes the due date of a task.
    func setDue(_ item: TodoItem, _ due: DueDate?) {
        guard !item.isPending, let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].due = due
        withAnimation(.easeInOut(duration: 0.2)) { items = Self.sorted(items) }

        Task {
            do {
                try await backend.setDue(item.id, due)
            } catch {
                self.error = error.localizedDescription
                await load()
            }
        }
    }

    /// Ticks a task off: it shows as done for a moment, then leaves the list.
    func complete(_ item: TodoItem) {
        guard !item.isPending, !completing.contains(item.id) else { return }
        completing.insert(item.id)

        Task {
            try? await Task.sleep(nanoseconds: Self.completeAnimation)
            withAnimation(.easeOut(duration: 0.2)) { items.removeAll { $0.id == item.id } }
            var failed = false
            do {
                try await backend.markDone(item.id)
            } catch {
                self.error = error.localizedDescription
                failed = true
            }
            completing.remove(item.id)
            if failed { await load() } // bring it back if it could not be saved
        }
    }

    /// Deletes a task, if the edition allows it.
    func delete(_ item: TodoItem) {
        guard canDelete, !item.isPending else { return }
        withAnimation(.easeOut(duration: 0.2)) { items.removeAll { $0.id == item.id } }

        Task {
            do {
                try await backend.delete(item.id)
            } catch {
                self.error = error.localizedDescription
                await load()
            }
        }
    }

    /// Same order as the Notion query: dated tasks first (earliest first), then the rest in
    /// the order they were added. Ties keep their original order.
    static func sorted(_ list: [TodoItem]) -> [TodoItem] {
        list.enumerated().sorted { a, b in
            switch (a.element.due, b.element.due) {
            case let (x?, y?): return x.date != y.date ? x.date < y.date : a.offset < b.offset
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return a.offset < b.offset
            }
        }.map(\.element)
    }
}
