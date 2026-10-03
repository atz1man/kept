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

Then `npm run preflight`. It reads every placeholder above out of the files they
live in and stays red until each is filled; the retailer-table check in section 3
is on it too. Green before you Archive — `test/preflight.test.ts` holds the checks.

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
| ✅ | No prices or unlocks in the iOS build (guideline 3.1.1) | done | `src/lib/pricing.ts`, APN-18 |
| ✅ | iPhone only — no iPad layout to be judged on (2.4.1) | done | `test/ios-device-family.test.ts` |
| ✅ | A privacy policy page, served by the app and linked from Settings (5.1.1) | done | `/privacy/` |
| ✅ | No invented ratings or testimonials on the marketing page | done | APN-17 |
| ✅ | Export compliance answered once, in `Info.plist`, so builds are not held for it | done — **you are the one declaring it**; read the comment above `ITSAppUsesNonExemptEncryption` and confirm | `test/ios-export-compliance.test.ts` fails if the app ever does more than verify a signature |
| ☐ | Every retailer window checked against the shop's live page | anyone on a normal connection: `npm run check:retailers` | APN-16 — reads each shop's own returns page in a browser and writes the quoted sentences to `store/retailer-check/<date>.md`. It never edits the table: read the quotes, correct `stores.ts` by hand, commit the report beside the change, then set `TABLE_CHECKED_ON`. A moved page shows as unreadable — fix its URL in `store/retailer-sources.json`. Currys is the likeliest to be wrong: the table says 14 days from purchase, several sources say 30 from delivery. **3 Oct 2026:** the table is 92 shops, 82 confirmed on the closing run (`store/retailer-check/2026-10-03-2.md`). Eight have refused an automated browser or moved their page on every run — Amazon, Argos, ASOS, Boots, Currys, H&M, John Lewis, Zara — and need a person |
| ✅ | The candidate retailers read, and the ones that check out added to the table | done 3 Oct 2026 | 72 added over three readings (`store/retailer-check/2026-10-03-candidates*.md`); Liberty, New Look, Snow+Rock and Fortnum & Mason added once a row could hold an online window of its own; Dyson held (a window per product). Re-run it as shops are added: UK retailers not yet in `stores.ts` are listed in `store/retailer-candidates.json`. The command finds each one's returns page from its homepage and quotes what it says to `store/retailer-check/<date>-candidates.md`. Add a shop by hand from the quotes, with its page in `retailer-sources.json`; set `commonWord` where the candidate file does |
| ☐ | Policy Watch has a routine: check the pages monthly, publish only cited changes | **you**, monthly | `store/POLICY-WATCH.md` — `npm run check:retailers`, then `npm run feed:add` with the retailer's own page as `--source` |
| ☐ | The feed key pair, so policy updates are signed | **you** | APN-19 — optional for v1; the app works unsigned |
| ✅ | The sample policy changes are labelled as samples, and none is published as news | done | APN-84 — labelled on the Watch tab, never set a real window, never speak to a real receipt; the served feed is empty until a change is checked against the retailer. `test/sample-changes.test.ts` |

## 4. The listing

| | Step | Who | Where |
|---|---|---|---|
| ✅ | Name, subtitle, promotional text, description, keywords, review notes | done | `store/listing.json`, held by `test/store-listing.test.ts` |
| ✅ | Privacy answers: **Data Not Collected**, no tracking | done | matches `PrivacyInfo.xcprivacy` |
| ✅ | Screenshot storyboard at 1290 × 2796 — four shots (deadlines, the two clocks, a pasted order, a scanned till receipt), from the iOS bundle booted as native, UK locale | done | `npm run build:ios && npm run store:screenshots`. They show the seed's retailer data, so they wait on APN-16 like the listing does |
| ☐ | Retake the screenshots in the Simulator, for the real status bar | **you** (Mac) | `xcrun simctl io booted screenshot` |
| ☐ | Age rating questionnaire → 4+ | **you** | App Store Connect |

## 5. Ship

| | Step | Who | Where |
|---|---|---|---|
| ☐ | TestFlight to 5–10 people; watch for a *second* receipt | **you** | APN-27 — who to ask, what to ask them, and what counts as a failure: `store/TESTFLIGHT.md` |
| ☐ | Submit for review | **you** | APN-28 |

### Questions the review team may ask, answered in `store/listing.json` → `reviewNotes`

- **Do I need an account?** No — everything is on the device.
- **Where does the data go?** Nowhere; the one download carries nothing about the person.
- **Are there purchases?** Not in this version.
