# Ondessa store submission kit

Everything App Store Connect and Google Play Console ask for, in the order they ask for it. Listing text lives in `fastlane/metadata/` (every field is already inside its character limit), images live here in `store/`.

> **URLs:** the store listing uses the free Vercel address (https://v0-recreate-ui-from-screenshot-f8.vercel.app). If you buy a custom domain later, point it at the Vercel project and replace the address in `src/content/company.ts` and `fastlane/metadata`. Apple rejects listings whose support or privacy URL does not load.

## 1. Images

| Store | Slot | Size | Files |
|---|---|---|---|
| App Store | iPhone 6.9" (required) | 1320 × 2868 | `ios/screenshots/iphone-6.9/01…07` |
| App Store | iPhone 6.5" (fallback) | 1242 × 2688 | `ios/screenshots/iphone-6.5/01…07` |
| Google Play | Phone screenshots | 1080 × 1920 | `android/screenshots/phone/01…07` |
| Google Play | Feature graphic | 1024 × 500 | `android/feature-graphic.png` |
| Google Play | App icon | 512 × 512 | `android/icon-512.png` |

The app is set to iPhone only, so no iPad screenshots are needed. Every screen is the real app running real data, which matters: guideline 2.3.3 rejects screenshots that misrepresent the app.

Upload in numbered order. Slide 1 is what most people see in search, so it carries the core promise.

Regenerate after any design or content change:

```
npm run store:assets
```

## 2. App Store Connect

### App information
| Field | Value |
|---|---|
| Name | `fastlane/metadata/ios/en-US/name.txt` |
| Subtitle | `subtitle.txt` |
| Primary category | Health & Fitness |
| Secondary category | Medical is **not** recommended (triggers stricter review). Use Lifestyle or leave empty. |
| Content rights | No third-party content |
| Copyright | `2026 <legal entity from company.ts>` |

### Version page
Promotional text, description, keywords, support URL, marketing URL and What's New are in `fastlane/metadata/ios/en-US/`. The description already contains the auto-renewal terms and the not-a-medical-device line that reviewers look for (guidelines 3.1.2 and 1.4.1).

### Age rating questionnaire
Answer **None** to everything except:

| Question | Answer |
|---|---|
| Medical or treatment information | Infrequent / Mild |
| Unrestricted web access | No |
| Age assurance / made for kids | No |

Expected result: 12+. Do not choose "Made for Kids".

### App Privacy ("nutrition label")
Select **Data Not Collected**. This is accurate because health data never leaves the device, there is no account, no analytics SDK and no ads SDK. Purchases go through Apple and are not collected by Ondessa.

If you later add server-side receipt validation, the transaction ID becomes "Purchases, not linked to identity, App Functionality". Update the label the same day.

### Subscriptions
Create one subscription group.

| Field | Value |
|---|---|
| Group name | Ondessa Membership |
| Product 1 ID | `ondessa.membership.annual` · 1 year · $59.99 · level 1 |
| Product 1 display name | Ondessa Yearly |
| Product 1 description | Every feature, one payment a year. |
| Product 2 ID | `ondessa.membership.monthly` · 1 month · $8.99 · level 1 |
| Product 2 display name | Ondessa Monthly |
| Product 2 description | Every feature, billed monthly. |
| Review screenshot | Capture the Plans screen from a TestFlight build (sandbox prices visible). The kit can't produce this one because prices must come from StoreKit. |

Submit both products **with** the first app version, or the reviewer sees an empty paywall and rejects under 2.1.

### App Review information
Sign-in required: **No**. Paste this in Notes:

```
Ondessa has no account system. All health data stays on the device.

To review:
1. Tap Start and complete setup (about 30 seconds). Enter any recent period date.
2. You will see the first prediction, then the membership screen.
3. Purchase with your sandbox account to unlock the app, or tap "Restore purchases".
4. Settings > Privacy Center shows passcode encryption, encrypted backup, export and permanent deletion.

Ondessa is not a medical device and says so on the Today screen, in onboarding and in the Terms. Predictions are estimates with visible confidence levels; the app never claims to confirm ovulation or pregnancy and is not contraception.

Health content is general information with sources listed on every article; it is not presented as medical advice.
Contact: <name, phone, email>
```

## 3. Google Play Console

### Store listing
Title, short description and full description: `fastlane/metadata/android/en-US/`. Category: Health & Fitness. Tags: Period tracker, Women's health.

### App content forms
| Form | Answer |
|---|---|
| Privacy policy | Public URL of the in-app policy |
| Ads | No ads |
| App access | All functionality available without credentials |
| Target audience | 18 and over |
| Content rating (IARC) | Reference to health topics: yes. Everything else: no |
| Health apps declaration | Period tracking, Fertility, Pregnancy. Not a medical device. |
| Data safety | **No data collected, no data shared.** Data is encrypted in transit: not applicable (nothing is transmitted). Users can request deletion: yes, in-app, instant. |
| Financial features | None |
| Government app | No |

### Subscriptions
Same two product IDs and prices as Apple. Base plans: `yearly` (P1Y, auto-renewing) and `monthly` (P1M, auto-renewing). Grace period 7 days.

## 4. Still open before you press Submit

`npm run release:check` is the source of truth. As of today it blocks on:

1. Clinical sign-off on articles, pregnancy week notes and prediction thresholds.
2. Lawyer-reviewed Terms and Privacy Policy.
3. Company details in `src/content/company.ts` (organisation developer account, not personal: guideline 5.1.1(ix)).
4. Real-device test of purchase, restore, cancel, Face ID and reminders on a TestFlight build.
5. The real domain behind the support and privacy URLs.

Nothing in this kit can be done for you without a Mac and your developer accounts: archive in Xcode, upload, attach the build to the version, then submit.
