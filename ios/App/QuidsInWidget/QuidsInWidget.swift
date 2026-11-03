import SwiftUI
import WidgetKit

// The Home Screen and Lock Screen widget: the next return deadlines.
//
// It reads the snapshot the app writes into the App Group container
// (src/lib/widget-snapshot.ts → packages/widget-bridge) and counts days from
// the DATES in it at each midnight, so it stays right on days the app is not
// opened. It never reaches the network and holds nothing the app did not
// already hold.

// MARK: - The snapshot, as the app writes it

struct WidgetDeadline: Codable, Hashable {
    let store: String
    let item: String
    /// YYYY-MM-DD, the last day it can go back, inclusive.
    let deadline: String
    let pence: Int
    /// The earliest the window can close, not the date it does.
    let atLeast: Bool
}

struct WidgetSnapshot: Codable {
    let version: Int
    let next: [WidgetDeadline]
    let more: Int
}

enum SnapshotStore {
    /// The same key packages/widget-bridge writes. Held together by test/widget.test.ts.
    static let snapshotKey = "kept.widget.snapshot"

    static func read() -> WidgetSnapshot? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "KeptAppGroup") as? String,
              let json = UserDefaults(suiteName: group)?.string(forKey: snapshotKey),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
              snapshot.version == 1 else { return nil }
        return snapshot
    }
}

// MARK: - Dates, on the phone's calendar

enum Days {
    static let calendar = Calendar.current

    static func date(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    /// Whole days from `today` to the deadline; 0 on the last day.
    static func left(_ deadline: Date, from today: Date) -> Int {
        calendar.dateComponents([.day], from: calendar.startOfDay(for: today), to: calendar.startOfDay(for: deadline)).day ?? 0
    }

    static func words(_ left: Int, atLeast: Bool) -> String {
        let n = left == 0 ? "Last day" : left == 1 ? "1 day left" : "\(left) days left"
        return atLeast && left > 0 ? "At least \(n.lowercased())" : n
    }

    static func money(_ pence: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "GBP"
        f.locale = Locale(identifier: "en_GB")
        return f.string(from: NSNumber(value: Double(pence) / 100)) ?? "£\(pence / 100)"
    }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    /// Deadlines still ahead on `date`, soonest first. Nil when the app has written nothing yet.
    let rows: [(item: WidgetDeadline, left: Int)]?
    let more: Int
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), rows: [(item: WidgetDeadline(store: "ASOS", item: "Linen shirt", deadline: "", pence: 3200, atLeast: false), left: 2)], more: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : entry(on: Date(), from: SnapshotStore.read()))
    }

    /// One entry now and one at each of the next seven midnights, then ask again:
    /// the days left change at midnight and at no other time.
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let snapshot = SnapshotStore.read()
        let now = Date()
        var entries = [entry(on: now, from: snapshot)]
        var day = Days.calendar.startOfDay(for: now)
        for _ in 0..<7 {
            guard let next = Days.calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
            entries.append(entry(on: day, from: snapshot))
        }
        completion(Timeline(entries: entries, policy: .after(day)))
    }

    func entry(on date: Date, from snapshot: WidgetSnapshot?) -> Entry {
        guard let snapshot else { return Entry(date: date, rows: nil, more: 0) }
        let rows = snapshot.next.compactMap { item -> (item: WidgetDeadline, left: Int)? in
            guard let deadline = Days.date(item.deadline) else { return nil }
            let left = Days.left(deadline, from: date)
            return left >= 0 ? (item: item, left: left) : nil
        }
        return Entry(date: date, rows: rows, more: snapshot.more)
    }
}

// MARK: - Views

struct DeadlineRow: View {
    let item: WidgetDeadline
    let left: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text(item.store).font(.caption).bold().lineLimit(1)
                Text(item.item).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 1) {
                Text(Days.words(left, atLeast: item.atLeast)).font(.caption2).bold()
                    .foregroundStyle(left <= 3 ? Color.red : Color.primary)
                Text(Days.money(item.pence)).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}

struct QuidsInWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        switch family {
        case .accessoryInline:
            if let first = entry.rows?.first {
                Text("\(first.item.store): \(Days.words(first.left, atLeast: first.item.atLeast).lowercased())")
            } else {
                Text("No returns due")
            }
        case .accessoryRectangular:
            if let first = entry.rows?.first {
                VStack(alignment: .leading) {
                    Text(first.item.store).font(.headline).lineLimit(1)
                    Text(first.item.item).lineLimit(1)
                    Text(Days.words(first.left, atLeast: first.item.atLeast))
                }
            } else {
                Text("No returns due")
            }
        default:
            content(rows: family == .systemSmall ? 1 : family == .systemMedium ? 2 : 4)
        }
    }

    @ViewBuilder
    func content(rows limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Return by").font(.caption2).foregroundStyle(.secondary)
            if let rows = entry.rows {
                if rows.isEmpty {
                    Text("Nothing due back").font(.caption)
                } else {
                    ForEach(Array(rows.prefix(limit).enumerated()), id: \.offset) { _, row in
                        DeadlineRow(item: row.item, left: row.left)
                    }
                    let hidden = rows.count - min(rows.count, limit) + entry.more
                    if hidden > 0 {
                        Text("+\(hidden) more").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } else {
                Text("Open Quids In to see your deadlines here").font(.caption)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - The widget

@main
struct QuidsInWidget: Widget {
    let kind = "QuidsInNextDeadlines"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                QuidsInWidgetView(entry: entry).containerBackground(.background, for: .widget)
            } else {
                QuidsInWidgetView(entry: entry).padding()
            }
        }
        .configurationDisplayName("Return deadlines")
        .description("The next things you can still take back, and how long you have.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryRectangular])
    }
}
