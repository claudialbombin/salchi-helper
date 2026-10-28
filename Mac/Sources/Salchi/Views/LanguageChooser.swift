import SwiftUI

/// Shown inside the card the first time Salchi starts: one button per language, each written
/// in its own language, with the system's language already selected.
struct LanguageChooser: View {
    @ObservedObject private var l10n = L10n.shared
    @State private var selection = L10n.shared.language

    private let columns = [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)]

    /// Title, the scrolling grid of languages and the confirm button.
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("language.choose")).font(.system(size: 14, weight: .bold))

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 4) {
                        ForEach(l10n.languages) { language in
                            languageButton(language)
                        }
                    }
                }
                .onAppear { proxy.scrollTo(selection, anchor: .center) }
            }

            HStack {
                Spacer()
                Button(tr("language.continue")) { l10n.choose(selection) }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
            }
            .font(.system(size: 12))
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// One language, highlighted when selected.
    private func languageButton(_ language: AppLanguage) -> some View {
        let selected = language.code == selection
        return Button { selection = language.code } label: {
            Text(language.name)
                .font(.system(size: 12, weight: selected ? .semibold : .regular))
                .foregroundColor(selected ? .black : .primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(RoundedRectangle(cornerRadius: 7).fill(selected ? Color.highlight : Color.clear))
                // Each name is laid out in its own direction, whatever the current language.
                .environment(\.layoutDirection, language.dir == "rtl" ? .rightToLeft : .leftToRight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .id(language.code)
    }
}
