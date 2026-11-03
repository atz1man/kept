import Foundation
import Capacitor
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Hands the Home Screen widget its snapshot (src/lib/widget-snapshot.ts).
///
/// The app and the widget are two programs. The only place both can read is
/// the App Group container on the phone, named by the `KeptAppGroup` key in
/// the app's Info.plist, which the build fills from `KEPT_APP_GROUP` so the
/// app, the widget and the entitlements cannot name different groups.
/// Nothing here touches the network.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise)
    ]

    /// The key the widget reads. Held to `QuidsInWidget.swift` by test/widget.test.ts.
    static let snapshotKey = "kept.widget.snapshot"

    @objc func write(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("No snapshot given.", "BAD_INPUT")
            return
        }
        guard let group = Bundle.main.object(forInfoDictionaryKey: "KeptAppGroup") as? String,
              let shared = UserDefaults(suiteName: group) else {
            call.reject("No App Group to share with the widget.", "UNAVAILABLE")
            return
        }
        shared.set(json, forKey: WidgetBridgePlugin.snapshotKey)
        #if canImport(WidgetKit)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        #endif
        call.resolve()
    }
}
