import Foundation
import Capacitor
import StoreKit

/// The one thing kept sells — unlimited receipts, paid for once — through the
/// App Store, with StoreKit 2.
///
/// StoreKit 2 checks each transaction's signature on the device and hands it
/// over as `.verified` or `.unverified`. Only a verified transaction unlocks
/// anything, so there is no server to run and nothing a person types, or a
/// proxy rewrites, can unlock the app.
///
/// StoreKit 2 needs iOS 15 and the app runs from 13. On 13 and 14 every call
/// answers `UNAVAILABLE`, and the JavaScript treats the unlock as not for sale
/// there. That also lifts the free tier's cap: a limit with no way past it is
/// a wall, not a tier (`lib/pricing.ts`).
///
/// What the JavaScript decides from these answers, and every outcome's words,
/// are in `lib/app-store.ts`, which is tested; this file only asks StoreKit
/// and says what it was told.
@objc(PurchasesPlugin)
public class PurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PurchasesPlugin"
    public let jsName = "Purchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    /// Transactions that arrive outside a purchase call:
    /// - an Ask to Buy approval;
    /// - a purchase made on another device;
    /// - a refund;
    /// - a purchase a bank's check interrupted and that finished later;
    /// - anything left unfinished when the app last closed, which StoreKit
    ///   hands over once at launch.
    ///
    /// This listens for the app's whole life, from `load()`, which Capacitor
    /// calls as the app starts, so none of them is missed.
    private var updates: Task<Void, Never>?

    override public func load() {
        guard #available(iOS 15.0, *) else { return }
        updates = Task.detached(priority: .background) { [weak self] in
            for await result in Transaction.updates {
                // Finished only once verified. An unverified transaction is left
                // unfinished, so StoreKit offers it again, rather than being
                // acknowledged as if it counted.
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
                // The JavaScript asks `entitlement` again rather than being told
                // the answer here: there is one place that reads ownership.
                self?.notifyListeners("entitlementChanged", data: [:])
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    /// What the App Store sells under these ids, priced for this person's
    /// storefront. `displayPrice` is Apple's own string ("£9.99", "9,99 €"),
    /// shown as it is: the app never formats a price it did not set.
    @objc func products(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.unavailable("StoreKit 2 needs iOS 15.")
            return
        }
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let found = try await Product.products(for: ids)
                call.resolve([
                    "products": found.map { product in
                        [
                            "id": product.id,
                            "displayName": product.displayName,
                            "displayPrice": product.displayPrice
                        ]
                    },
                    // Purchases can be switched off by Screen Time or by whoever
                    // manages the phone. The App Store's sheet would then refuse,
                    // so the app says so before anyone presses anything.
                    "canPay": AppStore.canMakePayments
                ])
            } catch {
                call.reject(error.localizedDescription, Self.reason(error))
            }
        }
    }

    /// Buys a product. The App Store shows its own sheet, with the price, the
    /// Apple ID and Face ID, and that sheet is the confirmation; kept adds none.
    @objc func purchase(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.unavailable("StoreKit 2 needs iOS 15.")
            return
        }
        guard let id = call.getString("id") else {
            call.reject("No product was named.", "INVALID")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.resolve(["outcome": "failed", "reason": "not-for-sale"])
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["outcome": "purchased"])
                    case .unverified:
                        // Paid for, perhaps, but not provably. Nothing unlocks
                        // on a signature that does not check, and the
                        // transaction is left unfinished so StoreKit offers it
                        // again.
                        call.resolve(["outcome": "unverified"])
                    }
                case .pending:
                    // Ask to Buy, or a bank's check. The answer arrives later,
                    // through `Transaction.updates`.
                    call.resolve(["outcome": "pending"])
                case .userCancelled:
                    call.resolve(["outcome": "cancelled"])
                @unknown default:
                    call.resolve(["outcome": "failed", "reason": "unknown"])
                }
            } catch {
                let why = Self.reason(error)
                call.resolve(["outcome": why == "cancelled" ? "cancelled" : "failed", "reason": why])
            }
        }
    }

    /// Whether this Apple ID owns the product, as StoreKit knows it on this
    /// iPhone. The answer is one of:
    /// - `owned`;
    /// - `revoked`: refunded, or no longer shared by the family;
    /// - `unverified`;
    /// - `none`: no record of it here.
    ///
    /// `none` is not proof the product was never bought. On a new phone the
    /// record can arrive later, which is what `restore` is for. So the app
    /// relocks only on `revoked`, and a paying customer is never locked out
    /// because a record was slow to arrive.
    @objc func entitlement(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.unavailable("StoreKit 2 needs iOS 15.")
            return
        }
        guard let id = call.getString("id") else {
            call.reject("No product was named.", "INVALID")
            return
        }
        Task {
            guard let latest = await Transaction.latest(for: id) else {
                call.resolve(["state": "none"])
                return
            }
            switch latest {
            case .verified(let transaction):
                call.resolve(["state": transaction.revocationDate == nil ? "owned" : "revoked"])
            case .unverified:
                call.resolve(["state": "unverified"])
            }
        }
    }

    /// Restore purchase. This asks the App Store for this Apple ID's purchases
    /// now, and may ask the person to sign in, which is why it runs only when
    /// they press the button. App Review expects that button for a one-off
    /// purchase, and expects it never to run by itself.
    @objc func restore(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.unavailable("StoreKit 2 needs iOS 15.")
            return
        }
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["outcome": "synced"])
            } catch {
                let why = Self.reason(error)
                call.resolve(["outcome": why == "cancelled" ? "cancelled" : "failed", "reason": why])
            }
        }
    }

    /// The failures the app words differently. Anything else is "unknown", and
    /// gets the careful sentence: if it went through after all, the app unlocks
    /// when StoreKit says so.
    @available(iOS 15.0, *)
    private static func reason(_ error: Error) -> String {
        if let error = error as? StoreKitError {
            switch error {
            case .userCancelled:
                return "cancelled"
            case .networkError:
                return "network"
            case .notAvailableInStorefront:
                return "not-for-sale"
            default:
                return "unknown"
            }
        }
        if let error = error as? Product.PurchaseError {
            switch error {
            case .purchaseNotAllowed:
                return "not-allowed"
            case .productUnavailable:
                return "not-for-sale"
            default:
                return "unknown"
            }
        }
        return "unknown"
    }
}
