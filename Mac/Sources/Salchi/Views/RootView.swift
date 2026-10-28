import SwiftUI

/// Switches between the dog (collapsed) and the card (expanded), in the current language.
struct RootView: View {
    @ObservedObject var store: TodoStore
    @ObservedObject var ui: UIState
    @ObservedObject private var l10n = L10n.shared
    let mover: WindowMover

    /// The card while expanded, the dog otherwise.
    var body: some View {
        Group {
            if ui.expanded {
                CardView(store: store, ui: ui, mover: mover)
            } else {
                DachshundDesk(count: store.items.count, hasError: store.error != nil, mover: mover)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Dates, weekdays, the 12/24-hour clock and right-to-left layout follow the language.
        .environment(\.locale, l10n.locale)
        .environment(\.calendar, l10n.calendar)
        .environment(\.layoutDirection, l10n.layoutDirection)
        // Rebuild every view when the language changes, so all `tr(...)` calls run again.
        .id(l10n.language)
    }
}
