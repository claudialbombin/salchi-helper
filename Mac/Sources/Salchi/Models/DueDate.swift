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

    /// Short Spanish label: "hoy", "mañana", "jueves", "30 oct", "3 ene 2027"… followed by
    /// " · 18:00" when the task has a time.
    static func label(_ due: DueDate, now: Date = Date()) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: due.date)
        ).day ?? 0

        var text: String
        switch days {
        case 0: text = "hoy"
        case 1: text = "mañana"
        case -1: text = "ayer"
        case 2...6: text = format(due.date, "EEEE")
        default:
            let sameYear = calendar.component(.year, from: due.date) == calendar.component(.year, from: now)
            text = format(due.date, sameYear ? "d MMM" : "d MMM yyyy")
        }
        if due.hasTime { text += " · " + format(due.date, "HH:mm") }
        return text
    }

    /// Next occurrence of a weekday, never today.
    /// - Parameter weekday: 1 = Sunday, 2 = Monday … 7 = Saturday (Foundation's numbering).
    static func nextWeekday(_ weekday: Int, from now: Date = Date()) -> Date {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: now)
        return calendar.nextDate(after: start, matching: DateComponents(weekday: weekday), matchingPolicy: .nextTime) ?? start
    }

    /// Formats with a Spanish locale and drops the dots of abbreviations ("oct." → "oct").
    private static func format(_ date: Date, _ pattern: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = pattern
        return formatter.string(from: date).replacingOccurrences(of: ".", with: "")
    }
}
