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
                quickPick(tr("picker.today")) { select(Date()) }
                quickPick(tr("picker.tomorrow")) { select(Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()) }
                quickPick(Self.weekdayName(7)) { select(DueFormat.nextWeekday(7)) }
                quickPick(Self.weekdayName(2)) { select(DueFormat.nextWeekday(2)) }
            }

            // Days before today are greyed out and cannot be picked.
            DatePicker("", selection: $day, in: Calendar.current.startOfDay(for: Date())..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .frame(maxWidth: .infinity)

            HStack(spacing: 8) {
                Toggle(tr("picker.atTime"), isOn: $hasTime)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 12))
                if hasTime {
                    // The range covers the whole date, so it only restricts the time when the day is today.
                    DatePicker("", selection: $day, in: Self.currentMinute()..., displayedComponents: .hourAndMinute)
                        .datePickerStyle(.stepperField)
                        .labelsHidden()
                        .fixedSize()
                }
                Spacer()
            }
            .onChange(of: hasTime) { enabled in
                // Midnight is never what the user means: suggest a time that makes sense instead.
                let calendar = Calendar.current
                let atMidnight = calendar.component(.hour, from: day) == 0 && calendar.component(.minute, from: day) == 0
                if enabled && atMidnight {
                    day = Self.suggestedTime(on: day)
                }
            }

            if isInPast {
                Text(hasTime ? tr("picker.pastTime") : tr("picker.pastDay"))
                    .font(.system(size: 11))
                    .foregroundColor(.red)
            }

            HStack {
                if canRemove {
                    Button(tr("task.removeDate")) { onDone(.set(nil)) }
                }
                Spacer()
                Button(tr("picker.confirm")) {
                    // Checked again on click: the time may have passed while the panel was open.
                    guard !isInPast else { return }
                    onDone(.set(result))
                }
                .buttonStyle(.borderedProminent)
                .disabled(isInPast)
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
            .help(tr("picker.close"))
        }
    }

    /// The chosen date; all-day dates are normalised to midnight.
    private var result: DueDate {
        if hasTime { return DueDate(date: day, hasTime: true) }
        return DueDate(date: Calendar.current.startOfDay(for: day), hasTime: false)
    }

    /// `true` when the chosen moment is already over: an earlier day, or today at an earlier time.
    private var isInPast: Bool {
        if hasTime { return day < Self.currentMinute() }
        return Calendar.current.startOfDay(for: day) < Calendar.current.startOfDay(for: Date())
    }

    /// The current time without seconds. Due times have minute precision, so the minute we are in
    /// still counts as valid; comparing with seconds would reject a time the picker itself offered.
    private static func currentMinute() -> Date {
        let calendar = Calendar.current
        let now = Date()
        return calendar.dateInterval(of: .minute, for: now)?.start ?? now
    }

    /// Default time for a day: 9:00, or the next full hour when 9:00 has already passed today.
    ///
    /// - Parameter date: Any moment of the chosen day.
    /// - Returns: The suggested moment. When no full hour is left today (after 23:00) it returns
    ///   9:00, which the panel flags as past so the user picks another day or time.
    private static func suggestedTime(on date: Date, now: Date = Date()) -> Date {
        let calendar = Calendar.current
        let morning = calendar.date(bySettingHour: defaultHour, minute: 0, second: 0, of: date) ?? date
        if morning > now { return morning }
        guard let nextHour = calendar.nextDate(after: now, matching: DateComponents(minute: 0), matchingPolicy: .nextTime),
              calendar.isDate(nextHour, inSameDayAs: date) else {
            return morning
        }
        return nextHour
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

    /// Name of a weekday in the current language, capitalised ("sábado" → "Sábado").
    /// - Parameter weekday: 1 = Sunday … 7 = Saturday (Foundation's numbering).
    private static func weekdayName(_ weekday: Int) -> String {
        let name = DueFormat.format(DueFormat.nextWeekday(weekday), template: "EEEE")
        return name.prefix(1).uppercased(with: L10n.shared.locale) + name.dropFirst()
    }

    /// Rounded shortcut button ("Today", "Tomorrow"…).
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
