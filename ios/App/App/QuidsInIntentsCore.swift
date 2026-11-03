import Foundation

// What Siri and Shortcuts say about the next deadlines, kept apart from the
// AppIntents declarations (QuidsInIntents.swift) so it has no framework but
// Foundation — which is what lets test/app-intents.test.ts compile and run it
// on Linux, where there is no AppIntents and no Mac.
//
// It reads the snapshot the app writes for the Home Screen widget
// (src/lib/widget-snapshot.ts → packages/widget-bridge): the same dates the
// widget counts from, so Siri, the widget and the app cannot disagree.

struct DueItem: Codable {
    let store: String
    let item: String
    /// YYYY-MM-DD, the last day it can go back, inclusive.
    let deadline: String
    let pence: Int
    /// The earliest the window can close, not the date it does.
    let atLeast: Bool
}

struct DueSnapshot: Codable {
    let version: Int
    let next: [DueItem]
    let more: Int
}

enum DueSummary {
    /// The key packages/widget-bridge writes. Held to it by test/app-intents.test.ts.
    static let snapshotKey = "kept.widget.snapshot"
    /// Where an intent that opens the app leaves what to open. packages/share-inbox takes it.
    static let openKey = "kept.intent.open"

    static func appGroup() -> UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "KeptAppGroup") as? String else { return nil }
        return UserDefaults(suiteName: group)
    }

    static func read(from defaults: UserDefaults?) -> DueSnapshot? {
        guard let json = defaults?.string(forKey: snapshotKey),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(DueSnapshot.self, from: data),
              snapshot.version == 1 else { return nil }
        return snapshot
    }

    static func date(_ iso: String, calendar: Calendar) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func money(_ pence: Int) -> String {
        let pounds = pence / 100, rest = pence % 100
        return rest == 0 ? "£\(pounds)" : String(format: "£%d.%02d", pounds, rest)
    }

    static func when(_ left: Int, atLeast: Bool) -> String {
        let core = left == 0 ? "today is the last day" : left == 1 ? "1 day left" : "\(left) days left"
        return atLeast && left > 0 ? "at least \(core)" : core
    }

    /// What Siri says. Never a deadline already past, and never "last day" for one counted from the order.
    static func sentence(_ snapshot: DueSnapshot?, today: Date, calendar: Calendar = .current) -> String {
        guard let snapshot else {
            return "Open Quids In once, and I’ll be able to tell you what’s due back."
        }
        let start = calendar.startOfDay(for: today)
        let open = snapshot.next.compactMap { item -> (item: DueItem, left: Int)? in
            guard let d = date(item.deadline, calendar: calendar),
                  let left = calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: d)).day,
                  left >= 0 else { return nil }
            return (item: item, left: left)
        }
        guard let first = open.first else {
            return "Nothing’s due back. You have no open returns in Quids In."
        }
        var out = "\(first.item.store), \(first.item.item): \(when(first.left, atLeast: first.item.atLeast)), \(money(first.item.pence)) back."
        let then = open.dropFirst().prefix(2).map { "\($0.item.store) \(when($0.left, atLeast: $0.item.atLeast))" }
        if !then.isEmpty { out += " Then " + then.joined(separator: ", and ") + "." }
        let beyond = open.count - 1 - then.count + snapshot.more
        if beyond > 0 { out += " And \(beyond) more in Quids In." }
        return out
    }

    /// Tell the app what to open when it next comes to the front: "add" or "scan".
    static func request(_ screen: String, in defaults: UserDefaults?) {
        defaults?.set(screen, forKey: openKey)
    }
}
