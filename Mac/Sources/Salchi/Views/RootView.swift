import SwiftUI

/// Switches between the dog (collapsed) and the card (expanded).
struct RootView: View {
    @ObservedObject var store: TodoStore
    @ObservedObject var ui: UIState
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
    }
}
