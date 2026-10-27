import AppKit
import SwiftUI

/// One task in the list: a tick box, the title and, below it, the due date if there is one.
///
/// Hovering shows quick buttons (set date, and delete in the local edition); right-clicking
/// opens a menu with every action.
struct TodoRow: View {
    let item: TodoItem
    /// Shown as done while the tick animation runs.
    let done: Bool
    let onComplete: () -> Void
    let onPickDate: () -> Void
    let onClearDate: () -> Void
    /// `nil` when the edition does not allow deleting.
    let onDelete: (() -> Void)?

    @State private var hovering = false

    /// Tick box, title, due date and hover buttons.
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Button(action: onComplete) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 15))
                    .foregroundColor(done ? .green : .secondary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .strikethrough(done)
                    .font(.system(size: 13))
                    .foregroundColor(done ? .secondary : .primary)
                    .opacity(item.isPending ? 0.5 : 1)
                    .fixedSize(horizontal: false, vertical: true)
                if let due = item.due {
                    dueLabel(due)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if hovering && !item.isPending {
                hoverButton(item.due == nil ? "calendar.badge.plus" : "calendar",
                            help: item.due == nil ? "Ponerle fecha" : "Cambiar fecha",
                            action: onPickDate)
                if let onDelete {
                    hoverButton("xmark", help: "Borrar", action: onDelete)
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 8).fill(hovering ? Color.primary.opacity(0.05) : Color.clear))
        .onHover { hovering = $0 }
        .contextMenu { menuItems }
    }

    /// Right-click menu. Its entries depend on the edition.
    @ViewBuilder
    private var menuItems: some View {
        Button("Hecho", action: onComplete)
        Button(item.due == nil ? "Ponerle fecha…" : "Cambiar fecha…", action: onPickDate)
        if item.due != nil {
            Button("Quitar fecha", action: onClearDate)
        }

        switch Edition.current {
        case .notion:
            if let link = item.calendarURL, let url = URL(string: link) {
                Button("Abrir en Google Calendar") { NSWorkspace.shared.open(url) }
            }
            Divider()
            Button("Abrir en Notion") {
                let pageID = item.id.replacingOccurrences(of: "-", with: "")
                if let url = URL(string: "https://www.notion.so/\(pageID)") { NSWorkspace.shared.open(url) }
            }
        case .local:
            if let url = GoogleCalendarLink.newEvent(for: item) {
                Button("Añadir a Google Calendar") { NSWorkspace.shared.open(url) }
            }
            if let onDelete {
                Divider()
                Button("Borrar", action: onDelete)
            }
        }
    }

    /// Coloured due-date line: red when overdue, orange when due today.
    /// Clicking it opens the Google Calendar event if there is one, or the date picker.
    private func dueLabel(_ due: DueDate) -> some View {
        let color: Color
        switch DueFormat.urgency(due) {
        case .overdue: color = .red
        case .today: color = .orange
        case .later: color = .secondary
        }

        return HStack(spacing: 3) {
            Image(systemName: due.hasTime ? "clock" : "calendar")
            Text(DueFormat.label(due))
            if item.calendarURL != nil {
                Image(systemName: "link")
            }
        }
        .font(.system(size: 11, weight: .medium))
        .foregroundColor(done ? .secondary : color)
        .help(item.calendarURL != nil ? "Está en tu Google Calendar (clic para abrirlo)" : "Cambiar fecha")
        .onTapGesture {
            if let link = item.calendarURL, let url = URL(string: link) {
                NSWorkspace.shared.open(url)
            } else {
                onPickDate()
            }
        }
    }

    /// Small borderless icon button shown while hovering the row.
    private func hoverButton(_ symbol: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12))
                .foregroundColor(.secondary)
        }
        .buttonStyle(.plain)
        .help(help)
    }
}
