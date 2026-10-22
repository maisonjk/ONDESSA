# App Store & Google Play Readiness

Built from three independent audits on 2026-10-22: an App Store submission specialist (checked against Apple's guidelines updated Oct 16, 2026 and current Google Play policy), a senior code and security reviewer, and a QA engineer. Run `npm run release:check` at any time; it fails while anything that would get the app rejected is still present.

## Status

| Area | State |
|---|---|
| Native iOS and Android projects (Capacitor 8) | ✅ Generated, all plugins synced |
| Opens into the product, no website wrapper (4.2) | ✅ |
| In-app subscriptions with restore and manage (3.1.1, 3.1.2) | ✅ Code complete · ⚠ needs App Store Connect products and sandbox testing |
| No license-key unlock in the apps (3.1.1) | ✅ Web only |
| Local notifications, Face ID unlock, share-sheet backup, haptics | ✅ Code complete · ⚠ needs device testing |
| Durable native storage, not WebView storage | ✅ With automatic migration |
| Privacy manifest, Face ID text, icons, splash | ✅ |
| Android target API 36, cloud backup off, no exact alarms | ✅ |
| No preview pass in store builds | ✅ Enforced |
| Data-loss and security fixes from code review | ✅ 85 unit tests + 139 end-to-end tests (all 13 QA bugs and 3 accessibility issues fixed and guarded) |
| Health content framed as general information with sources | ✅ Enforced by release:check |
| Final Privacy Policy and Terms | ✅ Finalized in-app and in `docs/legal/` (operator: Jiae Kim) |
| Company details, support email, public URLs | ✅ Filled; URLs use the free Vercel address until a custom domain is bought |
| Trademark clearance for "Ondessa" | ⚠ Search tmsearch.uspto.gov before launch |

## What only you can do, in order

1. **Form the publishing entity** (LLC or similar) and get a D-U-N-S number. Apple guideline 5.1.1(ix) expects health apps to come from an organisation. New personal Google Play accounts also need a 12-tester, 14-day closed test.
2. **Enrol** in the Apple Developer Program (organisation, $99/yr) and open a Google Play Console organisation account ($25 once).
3. **Clear the name.** Get a trademark search from counsel. If you change the name, update `appId` in `capacitor.config.ts` and the display name.
4. **Content.** Articles and predictions are presented as general information with sources, not as medically reviewed. Don't add review claims to the app, the store listing or the review notes unless a qualified professional has actually reviewed the content.
5. **Legal.** Have a lawyer finalise `docs/legal/privacy-policy.md` and `terms-of-use.md`, then update the in-app Privacy and Terms screens and remove the draft labels.
6. **Fill in `src/content/company.ts`** and publish the web build so the Privacy, Terms and Help URLs are live.
7. **Create the subscriptions:**
   - App Store Connect: subscription group "Ondessa Membership" with `ondessa.membership.annual` ($59.99/yr) and `ondessa.membership.monthly` ($8.99/mo). Add localised display names and a review screenshot of the paywall.
   - Google Play Console: same IDs, as subscriptions with one base plan each.
8. **Finish the purchase plumbing.** Enable the cordova-plugin-purchase StoreKit 2 extension, and add receipt validation (your own small endpoint or a validator service) so expiry, refunds and family sharing are enforced. Then update the App Privacy answers below if a server stores purchase records.
9. **Build and test on real devices.** Steps below.
10. **Run `npm run release:check`** until it passes, then submit.

## Building the apps

```bash
npm ci
npm run build:native          # vite build + cap sync
npx cap open ios              # Xcode (macOS only)
npx cap open android          # Android Studio
```

**Xcode:**
1. Set your Team and the bundle ID.
2. Add the In-App Purchase capability.
3. Set the version and build number.
4. Use Product → Archive, then distribute to TestFlight.

**Android Studio:**
1. Set up signing.
2. Build an App Bundle (.aab).
3. Upload it to an internal or closed test track.

## Testing purchases from Xcode

`ios/App/App/Ondessa.storekit` holds both subscriptions (yearly $59.99, monthly $8.99, 1-week free trial). In Xcode choose Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration → `Ondessa.storekit`. Purchases then run locally with no App Store Connect setup or charge; manage them under Debug → StoreKit → Manage Transactions. Set the scheme back to None to test against App Store Connect sandbox products.

## Device test plan (before every submission)

| Area | Test |
|---|---|
| Purchase | Sandbox buy of monthly and yearly; cancel mid-flow (no charge, no access); buy while already subscribed (no double charge) |
| Restore | Delete the app, reinstall, restore purchases; second device with the same Apple ID |
| Expiry | Sandbox renewal and expiry (accelerated renewal times); refund (access removed after validation) |
| Reminders | Enable each reminder; permission prompt appears only then; notification text is discreet; fires at 9:00 |
| Check-in quick replies | On the expected day, long-press the check-in: "Yes, today" logs a period day, "Spotting" logs spotting, "Not yet" logs nothing; with a passcode set, the entry is applied after unlock |
| Free trial | Configure an introductory free trial on both subscriptions in App Store Connect and Play Console; confirm Plans shows the timeline and "Start … free trial", and the local reminder fires 2 days before the end |
| Sharing | Partner sharing opens the share sheet with only the switched-on items; the calendar file imports into Calendar with "Ondessa" titles when discreet wording is on |
| Face ID | Enable, background for more than 5 minutes (auto-lock), unlock with Face ID, fall back to passcode, change passcode (Face ID turns off) |
| Data | Log for several days, force-quit mid-edit, reopen (nothing lost); airplane mode (everything works); low-storage device |
| Backup | Encrypted backup to Files; cancel the share sheet (no "last backup" recorded); restore on a fresh install before purchase |
| Delete | Delete everything, confirm the app returns to setup and nothing remains |
| Accessibility | VoiceOver and TalkBack through setup, logging and the paywall; Dynamic Type at the largest size; dark mode |

## Reviewer notes (paste into App Store Connect)

> Ondessa has no account or login; health data is stored only on the device. To test: tap "I understand, continue" and choose "Understand my cycle". Enter any recent date as the last period start and finish setup. The subscription screen appears; buy either plan with a Sandbox Apple ID. "Restore purchases" is on the same screen and under You → Membership. Reminders are under You → Reminders & settings, and Face ID unlock is under You → Privacy center once a passcode is set. The app does not use HealthKit. It is not a medical device and not a contraceptive; predictions are labelled as estimates with confidence levels, and each article lists its sources. Content is general information, not medical advice.

## App Privacy (Apple) and Data safety (Google)

| Configuration | Apple App Privacy | Google Data safety |
|---|---|---|
| StoreKit / Play Billing only, no server | **Data Not Collected** | No data collected or shared |
| With a receipt-validation server storing transactions | Purchases → Purchase History (App Functionality, not linked, no tracking) | Purchase history, collected, not shared, for app functionality |

- **Tracking:** none, so no tracking-permission prompt.
- **Encryption export compliance:** `ITSAppUsesNonExemptEncryption` is set to `NO`. The app uses only standard OS encryption to protect user data on the device. Confirm with counsel if unsure.

## Ratings and declarations

- **Apple age rating questionnaire:** Medical/treatment information: Frequent. Mature/suggestive themes: Infrequent (conception timing, optional intimacy logging). No user-generated content, chat, gambling or unrestricted web access. Confirm the rating the calculator produces.
- **Google:** content rating questionnaire; target audience 18+; **Health apps declaration**: period and fertility tracking, pregnancy, not a medical device.
- **Category:** Health & Fitness on both stores.

## Store listing

- **Subtitle (30 characters max):** Private cycle & pregnancy log
- **Promotional text:** Predictions that show their work. Your data stays on your phone.
- **Description outline:**
  1. On-device, no account.
  2. Predictions with confidence levels and explanations.
  3. My Cycle, My Patterns.
  4. Fertility estimates, clearly labelled as estimates.
  5. Pregnancy calendar.
  6. Perimenopause and irregular cycles.
  7. Subscription line: "Subscription required: $8.99/month or $59.99/year, renews automatically; cancel in your account settings."
  8. "Not a medical device or contraception."
  9. Terms and Privacy links.
- **Keywords (iOS, 100 characters):** period tracker,cycle,ovulation,fertility,pregnancy,perimenopause,private,PMS,calendar
- **Screenshots:** from the real app on 6.9" and 6.5" iPhones. Show Today, Calendar, Patterns, Fertility and Pregnancy, and state in the caption that a subscription is required.
- **Never** claim accuracy percentages, contraceptive use, or name competitors.

## Known limitations to disclose or fix later

- Purchase entitlement is checked on the device until receipt validation is added (step 8).
- iCloud device backups can include app data (disclosed in the privacy policy). Passcode-encrypted data stays encrypted.
- A 4–6 digit passcode protects against casual access. It does not protect against forensic attacks (see ADR-0005). Face ID unlock uses the keychain on this device only.

## Submission kit

Screenshots, listing text, form answers and review notes are in `store/README.md`. Listing text is in `fastlane/metadata/`. Regenerate screenshots with `npm run store:assets`.
