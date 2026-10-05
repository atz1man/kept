# Submitting kept to the App Store

In order. Each step says who can do it. Everything marked **done** is in this
repository and held by a test; everything marked **you** needs a Mac, an Apple
account, a decision, or an address only you can give.

## 1. Before anything builds

| | Step | Who | Where |
|---|---|---|---|
| ☐ | Apple Developer Program membership | **you** | developer.apple.com |
| ☐ | Register the App ID, then `npm run bundle-id uk.co.yourname.kept` | **you** | APN-21 |
| ☐ | A contact address for privacy questions → `CONTACT_EMAIL` in `src/lib/brand.ts` | **you** | the page shows a red notice until it is set |
| ☐ | Your domain → replace `REPLACE_ME` in `store/listing.json` | **you** | |
| ☐ | The Paid Applications Agreement, with bank and tax details | **you** | App Store Connect → Business. Until it is active the App Store sells nothing, even to a sandbox tester, and the app shows no price and no cap (see section 4b) |

Then `npm run preflight`. It reads every placeholder above out of the files they
live in and stays red until each is filled; the retailer-table check in section 3
is on it too. Green before you Archive — `test/preflight.test.ts` holds the checks.

Once the web app has a host, have it send one response header the build cannot
write itself: `Content-Security-Policy: frame-ancestors 'self'`. Every page
already carries the rest of the policy as a `<meta>` (`src/lib/csp.ts`), but a
`<meta>` cannot say who may put the app in a frame of their own, which is how a
look-alike page would dress itself in it.

## 2. The first build

| | Step | Who | Where |
|---|---|---|---|
| ☐ | `npm run build:ios && npx cap sync ios && cd ios/App && pod install` | **you** (Mac) | APN-22 |
| ☐ | Open `ios/App/App.xcworkspace`, set the signing team, build to your own iPhone | **you** (Mac) | APN-22 — nothing here has ever been compiled; expect surprises |
| ☐ | Check the keyboard never covers a field you are typing in | **you** (device) | APN-23 |
| ☐ | Check `PrivacyInfo.xcprivacy` is inside the built `.app` | **you** (Mac) | APN-25 |

## 3. What would get it rejected

| | Step | Who | Where |
|---|---|---|---|
| ✅ | The unlock is sold only through In-App Purchase, with Restore purchase beside it (3.1.1) | done | `packages/purchases` (StoreKit 2, verified on the device), decisions in `src/lib/app-store.ts`. `test/app-store.test.ts` pins every outcome, and `npm run ios` buys, cancels, waits for Ask to Buy, restores, refunds and goes offline on the bundle that ships. Where the App Store sells nothing, the app shows no price and no cap (APN-18) |
| ✅ | iPhone only — no iPad layout to be judged on (2.4.1) | done | `test/ios-device-family.test.ts` |
| ✅ | A privacy policy page, served by the app and linked from Settings (5.1.1) | done | `/privacy/` |
| ✅ | No invented ratings or testimonials on the marketing page | done | APN-17 |
| ✅ | Export compliance answered once, in `Info.plist`, so builds are not held for it | done — **you are the one declaring it**; read the comment above `ITSAppUsesNonExemptEncryption` and confirm | `test/ios-export-compliance.test.ts` fails if the app ever does more than verify a signature |
| ☐ | Every retailer window checked against the shop's live page | anyone on a normal connection: `npm run check:retailers` | APN-16 — reads each shop's own returns page in a browser and writes the quoted sentences to `store/retailer-check/<date>.md`. It never edits the table: read the quotes, correct `stores.ts` by hand, commit the report beside the change, then set `TABLE_CHECKED_ON`. A moved page shows as unreadable — fix its URL in `store/retailer-sources.json`. Currys is the likeliest to be wrong: the table says 14 days from purchase, several sources say 30 from delivery. **3 Oct 2026:** the table is 101 shops, 93 of them dated in `CHECKED_ON` with a quote from their own page (`test/verified.test.ts` holds each to it). The eight that refuse an automated browser — Amazon, Argos, ASOS, Boots, Currys, H&M, John Lewis, Zara — need a person with an ordinary browser: `npm run record:shop` lists them with their pages, and `npm run record:shop -- "<shop>" "<address>" "<sentence>"` files the quote and dates the shop, refusing an off-site page or a sentence that does not name the table's window. About two minutes a shop. Until then the app says, under each of their policies, that it is not yet checked |
| ✅ | The candidate retailers read, and the ones that check out added to the table | done 3 Oct 2026 | 72 added over three readings (`store/retailer-check/2026-10-03-candidates*.md`); Liberty, New Look, Snow+Rock and Fortnum & Mason added once a row could hold an online window of its own; Dyson held (a window per product). Re-run it as shops are added: UK retailers not yet in `stores.ts` are listed in `store/retailer-candidates.json`. The command finds each one's returns page from its homepage and quotes what it says to `store/retailer-check/<date>-candidates.md`. Add a shop by hand from the quotes, with its page in `retailer-sources.json`; set `commonWord` where the candidate file does |
| ☐ | Policy Watch has a routine: check the pages monthly, publish only cited changes | **you**, monthly | `store/POLICY-WATCH.md` — `npm run check:retailers`, then `npm run feed:add` with the retailer's own page as `--source` |
| ☐ | The feed key pair, so policy updates are signed | **you** | APN-19 — optional for v1; the app works unsigned |
| ✅ | The sample policy changes are labelled as samples, and none is published as news | done | APN-84 — labelled on the Watch tab, never set a real window, never speak to a real receipt; the served feed is empty until a change is checked against the retailer. `test/sample-changes.test.ts` |

## 4. The listing

| | Step | Who | Where |
|---|---|---|---|
| ✅ | Name, subtitle, promotional text, description, keywords, review notes | done | `store/listing.json`, held by `test/store-listing.test.ts` |
| ✅ | Privacy answers: **Data Not Collected**, no tracking | done | matches `PrivacyInfo.xcprivacy`. The purchase does not change this, as far as this repository can tell: Apple takes the payment and kept has no server to receive anything about it. The privacy page says so under "Buying the unlock". Confirm against Apple's current guidance when you answer |
| ✅ | Screenshot storyboard at 1290 × 2796 — four shots (deadlines, the two clocks, a pasted order, a scanned till receipt), from the iOS bundle booted as native, UK locale | done | `npm run build:ios && npm run store:screenshots`. They show the seed's retailer data, so they wait on APN-16 like the listing does |
| ☐ | Retake the screenshots in the Simulator, for the real status bar | **you** (Mac) | `xcrun simctl io booted screenshot` |
| ☐ | Age rating questionnaire → 4+ | **you** | App Store Connect |

## 4b. The in-app purchase

| | Step | Who | Where |
|---|---|---|---|
| ☐ | In Xcode, Signing & Capabilities → + Capability → **In-App Purchase**, on the App target | **you** (Mac) | Nothing in the repository changes when you add it, so nothing here can check it |
| ☐ | Create it: **Non-Consumable**, Product ID **`kept.unlimited`** exactly, reference name "Unlimited receipts" | **you** | App Store Connect → your app → In-App Purchases. The id is in `src/lib/app-store.ts` and `ios/App/Kept.storekit`, and Apple never lets an id be used twice, so a typo cannot be fixed by deleting it |
| ☐ | Price **£9.99** with the **United Kingdom** as the base country, so it matches the web's `UNLOCK.price`; Apple sets the other countries from it | **you** | The app shows whatever price the App Store sends for the person's country, so nothing in the code changes |
| ☐ | English (UK): display name "Unlimited receipts", description "No limit on receipts. Paid once." | **you** | The same words as `ios/App/Kept.storekit` |
| ☐ | Family Sharing: off unless you decide otherwise | **you** — a decision | `Kept.storekit` has it off. Turning it on later cannot be undone |
| ☐ | A review screenshot of where it is sold (Settings, the free plan), and add the purchase to the app version you submit. The first in-app purchase has to go with a version | **you** | The version page → In-App Purchases and Subscriptions |
| ☐ | A Sandbox tester; on a phone, buy, Restore purchase, and refund (Settings → App Store → Sandbox Account → Manage) | **you** (device) | Users and Access → Sandbox. TestFlight purchases are sandbox too, so testers are never charged |
| ☐ | Optional: buy without App Store Connect, in the Simulator. Drag `ios/App/Kept.storekit` into the Xcode project with no target ticked, then Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration. Debug → StoreKit → Manage Transactions refunds, approves Ask to Buy and fails a purchase on demand | **you** (Mac) | |

## 5. Ship

| | Step | Who | Where |
|---|---|---|---|
| ☐ | TestFlight to 5–10 people; watch for a *second* receipt | **you** | APN-27 — who to ask, what to ask them, and what counts as a failure: `store/TESTFLIGHT.md` |
| ☐ | Submit for review | **you** | APN-28 |

### Questions the review team may ask, answered in `store/listing.json` → `reviewNotes`

- **Do I need an account?** No — everything is on the device.
- **Where does the data go?** Nowhere; the one download carries nothing about the person.
- **Are there purchases?** One, "Unlimited receipts", paid once. It is under Settings → Unlock unlimited, with Restore purchase directly below it.
