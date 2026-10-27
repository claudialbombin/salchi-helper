import SwiftUI

/// The expanded state: a card with the header, the task list (or the date picker, or the
/// settings) and the bar to add new tasks.
struct CardView: View {
    @ObservedObject var store: TodoStore
    @ObservedObject var ui: UIState
    let mover: WindowMover

    /// Text being typed in the bottom bar.
    @State private var draft = ""
    /// Due date chosen for the task being typed.
    @State private var draftDue: DueDate?
    /// What the date panel is editing, or `nil` when it is closed.
    @State private var panel: DatePanelTarget?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().opacity(0.5)
            if ui.showSettings {
                ScrollView { SettingsView(store: store, ui: ui).padding(14) }
            } else if let target = panel {
                DatePanel(title: panelTitle(target), initial: initialDue(target)) { result in
                    apply(result, to: target)
                }
                .id(target.key)
                // While dating an existing task there is nothing to type.
                if target == .newTask {
                    Divider().opacity(0.5)
                    addBar
                }
            } else {
                taskList
                Divider().opacity(0.5)
                addBar
            }
        }
        .onChange(of: panel) { _ in updateEditing() }
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(nsColor: .windowBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.primary.opacity(0.08)))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        .padding(10)
    }

    // MARK: - Sections

    /// Title, counter and buttons. Dragging it moves the window.
    private var header: some View {
        HStack(spacing: 8) {
            Text("🐕 notitas").font(.system(size: 15, weight: .bold))
            Text("\(store.items.count)")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(.black)
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .background(Capsule().fill(Color.highlight))
            if store.loading {
                ProgressView().controlSize(.small).scaleEffect(0.7)
            }
            Spacer()
            iconButton("arrow.clockwise") { store.refresh() }
            iconButton(ui.pinned ? "pin.fill" : "pin") { ui.pinned.toggle() }
            iconButton("gearshape") { ui.showSettings.toggle() }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 2)
            .onChanged { _ in mover.changed() }
            .onEnded { _ in mover.ended() })
    }

    /// Error banner, empty state and the rows.
    private var taskList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                if let message = store.error {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundColor(.red)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.08)))
                }
                if store.items.isEmpty && store.error == nil {
                    Text("nada pendiente ✨")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                }
                ForEach(store.items) { item in
                    TodoRow(
                        item: item,
                        done: store.completing.contains(item.id),
                        onComplete: { store.complete(item) },
                        onPickDate: { panel = .item(item) },
                        onClearDate: { store.setDue(item, nil) },
                        onDelete: deleteAction(for: item)
                    )
                }
            }
            .padding(8)
        }
        .frame(maxHeight: .infinity)
    }

    /// Text field to add a task, with an optional due date shown as a chip.
    private var addBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "plus")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.secondary)
            TextField("apuntar algo…", text: $draft)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .focused($focused)
                .onSubmit(submit)
                .onExitCommand { focused = false }
            if let due = draftDue {
                Button { panel = .newTask } label: {
                    Text(DueFormat.label(due))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.black)
                        .lineLimit(1)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.highlight))
                }
                .buttonStyle(.plain)
                .help("Cambiar fecha")
            }
            iconButton(draftDue == nil ? "calendar.badge.plus" : "calendar") {
                panel = panel == .newTask ? nil : .newTask
            }
            .help("Ponerle fecha a lo que apuntes")
        }
        .padding(.leading, 14)
        .padding(.trailing, 10)
        .padding(.vertical, 8)
        .onChange(of: focused) { _ in updateEditing() }
        .onChange(of: draft) { _ in updateEditing() }
    }

    // MARK: - Actions

    /// Adds the typed task (with its date, if any) and clears the bar.
    private func submit() {
        let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        store.add(title, due: draftDue)
        draft = ""
        draftDue = nil
        if panel == .newTask { panel = nil }
    }

    /// Keeps the card open while something is half-done (typing, choosing a date), even if
    /// the cursor leaves it.
    private func updateEditing() {
        ui.editing = panel != nil || (focused && !draft.isEmpty) || (draftDue != nil && !draft.isEmpty)
    }

    /// Delete handler for a row, or `nil` in the edition that does not allow deleting.
    private func deleteAction(for item: TodoItem) -> (() -> Void)? {
        guard store.canDelete else { return nil }
        return { store.delete(item) }
    }

    /// Heading of the date panel for the given target.
    private func panelTitle(_ target: DatePanelTarget) -> String {
        switch target {
        case .newTask: return "¿Para cuándo?"
        case .item(let item): return "📅 " + item.title
        }
    }

    /// Current date of the target, read from the live list in case it changed meanwhile.
    private func initialDue(_ target: DatePanelTarget) -> DueDate? {
        switch target {
        case .newTask: return draftDue
        case .item(let item): return store.items.first(where: { $0.id == item.id })?.due ?? item.due
        }
    }

    /// Applies the date chosen in the panel and closes it.
    private func apply(_ result: DatePanelResult, to target: DatePanelTarget) {
        if case .set(let due) = result {
            switch target {
            case .newTask: draftDue = due
            case .item(let item): store.setDue(item, due)
            }
        }
        panel = nil
        if target == .newTask {
            // Wait for the bar to be back on screen before focusing it.
            DispatchQueue.main.async { focused = true }
        }
    }

    /// Small borderless header button with an SF Symbol.
    private func iconButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .semibold))
                .frame(width: 22, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundColor(.secondary)
    }
}
