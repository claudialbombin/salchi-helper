import Foundation
import Security

/// Stores the Notion integration token in the user's login keychain.
enum Keychain {
    /// Service/account pair identifying the item. Unchanged since 1.0 so the saved token is kept.
    private static let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.claudia.salchi.notion",
        kSecAttrAccount as String: "token",
    ]

    /// Saves (or replaces) the token.
    static func save(_ value: String) {
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(item as CFDictionary, nil)
    }

    /// - Returns: The stored token, or `nil` if there is none.
    static func load() -> String? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8), !token.isEmpty
        else { return nil }
        return token
    }
}
