import AppIntents
import Foundation

// Siri, Shortcuts and Spotlight actions (iOS 16+). The words are
// QuidsInIntentsCore.swift's; this file only declares them to the system.
// Nothing here reaches the network: the answer comes from the snapshot the
// app keeps on the phone for the Home Screen widget.

@available(iOS 16.0, *)
struct WhatsDueIntent: AppIntent {
    static var title: LocalizedStringResource = "What’s due back"
    static var description = IntentDescription("The next things you can still return, and how long you have.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let words = DueSummary.sentence(DueSummary.read(from: DueSummary.appGroup()), today: Date())
        return .result(dialog: IntentDialog(stringLiteral: words))
    }
}

@available(iOS 16.0, *)
struct AddReceiptIntent: AppIntent {
    static var title: LocalizedStringResource = "Add a receipt"
    static var description = IntentDescription("Opens Quids In ready to paste an order email or pick a file.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        DueSummary.request("add", in: DueSummary.appGroup())
        return .result()
    }
}

@available(iOS 16.0, *)
struct ScanReceiptIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan a receipt"
    static var description = IntentDescription("Opens Quids In with the camera ready to scan a till receipt.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        DueSummary.request("scan", in: DueSummary.appGroup())
        return .result()
    }
}

@available(iOS 16.0, *)
struct QuidsInShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: WhatsDueIntent(),
            phrases: [
                "What’s due back in \(.applicationName)",
                "What can I still return in \(.applicationName)",
                "Check my returns in \(.applicationName)",
            ],
            shortTitle: "What’s due back",
            systemImageName: "calendar.badge.clock"
        )
        AppShortcut(
            intent: AddReceiptIntent(),
            phrases: ["Add a receipt in \(.applicationName)", "Add a return to \(.applicationName)"],
            shortTitle: "Add a receipt",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: ScanReceiptIntent(),
            phrases: ["Scan a receipt in \(.applicationName)"],
            shortTitle: "Scan a receipt",
            systemImageName: "doc.viewfinder"
        )
    }
}
