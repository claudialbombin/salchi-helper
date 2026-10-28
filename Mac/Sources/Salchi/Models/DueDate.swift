import Foundation

/// When a task is due: either a whole day or a precise time.
struct DueDate: Equatable {
    /// For all-day tasks, local midnight of that day.
    var date: Date
    var hasTime: Bool
}

/// How close a due date is, used to colour its label.
enum DueUrgency {
    case overdue, today, later
}

/// Conversions between `DueDate`, Notion's date strings and the labels shown in the UI.
///
/// Notion stores all-day dates as `2026-10-30` and timed ones as `2026-10-30T18:00:00+01:00`.
/// The local edition uses the same strings so both editions share this code.
enum DueFormat {
    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// Encodes a due date the way Notion expects it.
    static func notion(_ due: DueDate) -> String {
        if !due.hasTime { return dayFormatter.string(from: due.date) }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = .current
        return formatter.string(from: due.date)
    }

    /// Decodes a Notion date string. Returns `nil` for anything it does not understand.
    static func parse(_ text: String) -> DueDate? {
        if text.count == 10 {
            guard let date = dayFormatter.date(from: text) else { return nil }
            return DueDate(date: date, hasTime: false)
        }
        // Notion sometimes includes milliseconds and sometimes not.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: text) { return DueDate(date: date, hasTime: true) }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: text) { return DueDate(date: date, hasTime: true) }
        return nil
    }

    /// Whether a due date is already past, today or later.
    static func urgency(_ due: DueDate, now: Date = Date()) -> DueUrgency {
        let calendar = Calendar.current
        let overdue: Bool
        if due.hasTime {
            overdue = due.date < now
        } else {
            overdue = calendar.startOfDay(for: due.date) < calendar.startOfDay(for: now)
        }
        if overdue { return .overdue }
        return calendar.isDate(due.date, inSameDayAs: now) ? .today : .later
    }

    /// Short label in the current language: "today", "tomorrow", "Thursday", "Oct 30",
    /// "Jan 3, 2027"… followed by the time when the task has one.
    static func label(_ due: DueDate, now: Date = Date()) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: due.date)
        ).day ?? 0

        var text: String
        switch days {
        case 0: text = tr("due.today")
        case 1: text = tr("due.tomorrow")
        case -1: text = tr("due.yesterday")
        case 2...6: text = format(due.date, template: "EEEE")
        default:
            let sameYear = calendar.component(.year, from: due.date) == calendar.component(.year, from: now)
            text = format(due.date, template: sameYear ? "dMMM" : "dMMMy")
        }
        if due.hasTime { text += " · " + format(due.date, template: "jmm") }
        return text
    }

    /// Next occurrence of a weekday, never today.
    /// - Parameter weekday: 1 = Sunday, 2 = Monday … 7 = Saturday (Foundation's numbering).
    static func nextWeekday(_ weekday: Int, from now: Date = Date()) -> Date {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: now)
        return calendar.nextDate(after: start, matching: DateComponents(weekday: weekday), matchingPolicy: .nextTime) ?? start
    }

    /// Formats a date in the current language. `template` lists the fields wanted (e.g. "dMMM");
    /// the locale decides their order and punctuation, and "j" picks a 24-hour or AM/PM clock.
    static func format(_ date: Date, template: String) -> String {
        let l10n = L10n.shared
        let formatter = DateFormatter()
        formatter.locale = l10n.locale
        formatter.setLocalizedDateFormatFromTemplate(template)
        let text = formatter.string(from: date)
        // Spanish abbreviations end in a dot ("30 oct."), which looks noisy in a tiny label.
        return l10n.language == "es" ? text.replacingOccurrences(of: ".", with: "") : text
    }
}
