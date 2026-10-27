import Foundation

/// Builds Google Calendar "create event" links with a task already filled in.
///
/// Used by the local edition, which has no background sync with Google: the user clicks
/// the link and just presses Save in the browser.
enum GoogleCalendarLink {
    /// Length of the event created for a task that has a time.
    static let timedEventDuration: TimeInterval = 30 * 60

    /// - Returns: The link, or `nil` if the task has no due date.
    static func newEvent(for item: TodoItem) -> URL? {
        guard let due = item.due else { return nil }

        let dates: String
        if due.hasTime {
            let end = due.date.addingTimeInterval(timedEventDuration)
            dates = utcStamp(due.date) + "/" + utcStamp(end)
        } else {
            // All-day events end on the following day (the end date is exclusive).
            let nextDay = Calendar.current.date(byAdding: .day, value: 1, to: due.date) ?? due.date
            dates = dayStamp(due.date) + "/" + dayStamp(nextDay)
        }

        var components = URLComponents(string: "https://calendar.google.com/calendar/render")
        components?.queryItems = [
            URLQueryItem(name: "action", value: "TEMPLATE"),
            URLQueryItem(name: "text", value: "🐕 " + item.title),
            URLQueryItem(name: "dates", value: dates),
            URLQueryItem(name: "details", value: "Apuntado en Salchi 🐕"),
        ]
        return components?.url
    }

    /// `20261031T101500Z`
    private static func utcStamp(_ date: Date) -> String {
        stamp(date, format: "yyyyMMdd'T'HHmmss'Z'", timeZone: TimeZone(identifier: "UTC")!)
    }

    /// `20261031`, in the user's time zone.
    private static func dayStamp(_ date: Date) -> String {
        stamp(date, format: "yyyyMMdd", timeZone: .current)
    }

    /// Formats a date with a fixed, locale-independent pattern.
    private static func stamp(_ date: Date, format: String, timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = format
        return formatter.string(from: date)
    }
}
