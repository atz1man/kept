import Foundation
import Capacitor

/// Collects what the share extension left (ios/App/QuidsInShare), once.
///
/// The extension writes one item into `Inbox/` in the App Group container:
/// the bytes, and a small JSON note of its name and type. Taking it reads
/// both and deletes both, so the same order is never offered twice. Nothing
/// here touches the network.
@objc(ShareInboxPlugin)
public class ShareInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareInboxPlugin"
    public let jsName = "ShareInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "take", returnType: CAPPluginReturnPromise)
    ]

    /// The folder and file names the extension writes. Held to ShareViewController.swift by test/share-extension.test.ts.
    static let inboxFolder = "Inbox"
    static let noteName = "shared.json"
    static let dataName = "shared.data"

    @objc func take(_ call: CAPPluginCall) {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "KeptAppGroup") as? String,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            call.resolve(["item": NSNull()])
            return
        }
        let inbox = container.appendingPathComponent(ShareInboxPlugin.inboxFolder, isDirectory: true)
        let noteURL = inbox.appendingPathComponent(ShareInboxPlugin.noteName)
        let dataURL = inbox.appendingPathComponent(ShareInboxPlugin.dataName)
        defer {
            try? FileManager.default.removeItem(at: noteURL)
            try? FileManager.default.removeItem(at: dataURL)
        }
        guard let noteData = try? Data(contentsOf: noteURL),
              let note = try? JSONSerialization.jsonObject(with: noteData) as? [String: String],
              let name = note["name"], let mime = note["mime"],
              let data = try? Data(contentsOf: dataURL) else {
            call.resolve(["item": NSNull()])
            return
        }
        call.resolve(["item": ["name": name, "mime": mime, "base64": data.base64EncodedString()]])
    }
}
