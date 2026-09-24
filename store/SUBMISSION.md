# Submitting kept to the App Store

In order. Each step says who can do it. Everything marked **done** is in this
repository and held by a test; everything marked **you** needs a Mac, an Apple
account, a decision, or an address only you can give.

## 1. Before anything builds

| | Step | Who | Where |
|---|---|---|---|
| ☐ | Apple Developer Program membership | **you** | developer.apple.com |
| ☐ | Register the App ID, then `npm run bundle-id uk.co.yourname.kept` | **you** | APN-21 |
| ☐ | A contact address for privacy questions → `CONTACT_EMAIL` in `src/privacy/Privacy.tsx` | **you** | the page shows a red notice until it is set |
| ☐ | Your domain → replace `REPLACE_ME` in `store/listing.json` | **you** | |

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
| ☐ | Every retailer window checked against the shop's live page | **you** or anyone with a browser | APN-16 — the listing says "20 UK retailers built in" and must be true when it ships. Currys is the likeliest to be wrong: the table says 14 days from purchase, several sources say 30 from delivery |
| ☐ | The feed key pair, so policy updates are signed | **you** | APN-19 — optional for v1; the app works unsigned |
| ☐ | The sample policy changes on the Watch tab are shown as news | **you** (decide) | A fresh install lists five retailer policy changes — "Zara: free postal returns ended", "ASOS: new 28-day window for frequent returners" — dated weeks ago and **not** labelled as samples, unlike the sample receipts. They are claims about named companies. Label them as samples, or verify each one, before launch |

## 4. The listing

| | Step | Who | Where |
|---|---|---|---|
| ✅ | Name, subtitle, promotional text, description, keywords, review notes | done | `store/listing.json`, held by `test/store-listing.test.ts` |
| ✅ | Privacy answers: **Data Not Collected**, no tracking | done | matches `PrivacyInfo.xcprivacy` |
| ✅ | Screenshot storyboard at 1290 × 2796 — three shots, from the iOS bundle booted as native, UK locale | done | `npm run build:ios && npm run store:screenshots`. They show the seed's retailer data, so they wait on APN-16 like the listing does |
| ☐ | Retake the screenshots in the Simulator, for the real status bar | **you** (Mac) | `xcrun simctl io booted screenshot` |
| ☐ | Age rating questionnaire → 4+ | **you** | App Store Connect |

## 5. Ship

| | Step | Who | Where |
|---|---|---|---|
| ☐ | TestFlight to 5–10 people; watch for a *second* receipt | **you** | APN-27 |
| ☐ | Submit for review | **you** | APN-28 |

### Questions the review team may ask, answered in `store/listing.json` → `reviewNotes`

- **Do I need an account?** No — everything is on the device.
- **Where does the data go?** Nowhere; the one download carries nothing about the person.
- **Are there purchases?** Not in this version.
