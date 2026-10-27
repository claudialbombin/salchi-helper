import SwiftUI

/// What the date panel is editing.
enum DatePanelTarget: Equatable {
    /// The task currently being typed in the bottom bar.
    case newTask
    /// An existing task in the list.
    case item(TodoItem)

    /// Stable identity, used to reset the panel's state when the target changes.
    var key: String {
        switch self {
        case .newTask: return "new"
        case .item(let item): return item.id
        }
    }
}

/// How the date panel was closed.
enum DatePanelResult {
    /// Closed without changes.
    case cancel
    /// Confirmed; `nil` means "remove the date".
    case set(DueDate?)
}

/// Picks a due date: quick buttons (today, tomorrow…), a month calendar and an optional time.
///
/// It is shown inside the card, in place of the list. A popover would be a separate window,
/// and the card would collapse as soon as the cursor moved onto it.
struct DatePanel: View {
    let title: String
    /// Show "Quitar fecha" only if there is a date to remove.
    let canRemove: Bool
    let onDone: (DatePanelResult) -> Void

    @State private var day: Date
    @State private var hasTime: Bool

    /// Time suggested the first time "A una hora" is ticked.
    private static let defaultHour = 9

    /// - Parameters:
    ///   - title: Shown at the top, e.g. the task's title.
    ///   - initial: Current due date, if any; the panel starts on it.
    ///   - onDone: Called once when the panel is confirmed or dismissed.
    init(title: String, initial: DueDate?, onDone: @escaping (DatePanelResult) -> Void) {
        self.title = title
        self.canRemove = initial != nil
        self.onDone = onDone
        _day = State(initialValue: initial?.date ?? Calendar.current.startOfDay(for: Date()))
        _hasTime = State(initialValue: initial?.hasTime ?? false)
    }

    /// Quick picks, month calendar, optional time and the confirm buttons.
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            HStack(spacing: 6) {
                quickPick("Hoy") { select(Date()) }
                quickPick("Mañana") { select(Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()) }
                quickPick("Sábado") { select(DueFormat.nextWeekday(7)) }
                quickPick("Lunes") { select(DueFormat.nextWeekday(2)) }
            }

            DatePicker("", selection: $day, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .frame(maxWidth: .infinity)

            HStack(spacing: 8) {
                Toggle("A una hora", isOn: $hasTime)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 12))
                if hasTime {
                    DatePicker("", selection: $day, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.stepperField)
                        .labelsHidden()
                        .fixedSize()
                }
                Spacer()
            }
            .onChange(of: hasTime) { enabled in
                // Midnight is never what the user means: suggest a morning time instead.
                let calendar = Calendar.current
                let atMidnight = calendar.component(.hour, from: day) == 0 && calendar.component(.minute, from: day) == 0
                if enabled && atMidnight {
                    day = calendar.date(bySettingHour: Self.defaultHour, minute: 0, second: 0, of: day) ?? day
                }
            }

            HStack {
                if canRemove {
                    Button("Quitar fecha") { onDone(.set(nil)) }
                }
                Spacer()
                Button("Listo") { onDone(.set(result)) }
                    .buttonStyle(.borderedProminent)
            }
            .font(.system(size: 12))
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// Title and close button.
    private var header: some View {
        HStack {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer()
            Button { onDone(.cancel) } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .semibold))
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
            .help("Cerrar sin cambiar")
        }
    }

    /// The chosen date; all-day dates are normalised to midnight.
    private var result: DueDate {
        if hasTime { return DueDate(date: day, hasTime: true) }
        return DueDate(date: Calendar.current.startOfDay(for: day), hasTime: false)
    }

    /// Moves the selection to another day, keeping the chosen time if there is one.
    private func select(_ date: Date) {
        let calendar = Calendar.current
        if hasTime {
            let hour = calendar.component(.hour, from: day)
            let minute = calendar.component(.minute, from: day)
            day = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: date) ?? date
        } else {
            day = calendar.startOfDay(for: date)
        }
    }

    /// Rounded shortcut button ("Hoy", "Mañana"…).
    private func quickPick(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.black)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Capsule().fill(Color.highlight.opacity(0.75)))
        }
        .buttonStyle(.plain)
    }
}
