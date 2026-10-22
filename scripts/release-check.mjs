// Release gate for App Store / Google Play submissions.
// Fails (exit 1) while anything that would get the app rejected, or that must not ship,
// is still present. Run: npm run release:check
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(p, 'utf8');
const blockers = [];
const manual = [];
const passed = [];
const check = (ok, pass, fail) => (ok ? passed.push(pass) : blockers.push(fail));

// 1. No preview or development access in a store build.
check(process.env.VITE_PREVIEW_PASS !== 'true', 'Preview pass disabled', 'VITE_PREVIEW_PASS=true is set. Store builds must not include the preview pass (guideline 2.1).');

// 2. Health content clinically reviewed (guidelines 1.4.1, 2.1; docs/08-editorial-policy.md).
const library = read('src/content/library.ts');
const articleBlocks = library.split(/\n  \{\n    slug: /).slice(1);
const unreviewed = articleBlocks.filter((b) => /review: AWAITING/.test(b)).map((b) => b.split("'")[1]);
check(unreviewed.length === 0, 'All articles clinically reviewed', `${unreviewed.length} article(s) awaiting clinical review: ${unreviewed.join(', ')}. Get sign-off or remove them from v1.`);
check(!/PREGNANCY_WEEKS_REVIEW: Article\['review'\] = AWAITING/.test(library), 'Pregnancy week notes reviewed', 'Pregnancy week-by-week notes are awaiting clinical review.');

// 3. Prediction thresholds signed off.
const rules = read('src/engine/rules.ts');
check(!/version: '[^']*provisional/.test(rules), 'Prediction rules signed off', 'src/engine/rules.ts is still marked provisional. A clinician must sign off the thresholds, then set a final version.');

// 4. Legal pages final, no draft or placeholder wording in user-facing screens.
const screens = readdirSync('src/screens').map((f) => read(join('src/screens', f))).join('\n');
const draftPhrases = ['pending legal review', 'working name pending trademark', 'Draft · pending', 'will be replaced by lawyer-reviewed'];
const foundDrafts = draftPhrases.filter((p) => screens.includes(p));
check(foundDrafts.length === 0, 'No draft or placeholder wording in screens', `Draft wording still in the app: "${foundDrafts.join('", "')}". Replace with final, lawyer-approved text (guidelines 2.1, 5.1.1).`);

// 5. Business details for the store listings.
const company = read('src/content/company.ts');
const empty = [...company.matchAll(/^\s+(\w+): '',/gm)].map((m) => m[1]);
check(empty.length === 0, 'Company details filled in', `Fill in src/content/company.ts: ${empty.join(', ')}.`);

// 6. Native projects present and configured.
check(existsSync('ios/App/App/PrivacyInfo.xcprivacy'), 'iOS privacy manifest present', 'ios/App/App/PrivacyInfo.xcprivacy is missing.');
const plist = existsSync('ios/App/App/Info.plist') ? read('ios/App/App/Info.plist') : '';
check(plist.includes('NSFaceIDUsageDescription'), 'Face ID usage description set', 'Info.plist needs NSFaceIDUsageDescription.');
const icon = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
check(existsSync(icon) && statSync(icon).size > 10_000, 'iOS app icon generated', 'iOS app icon missing; run npx @capacitor/assets generate.');
const androidManifest = existsSync('android/app/src/main/AndroidManifest.xml') ? read('android/app/src/main/AndroidManifest.xml') : '';
check(androidManifest.includes('android:allowBackup="false"'), 'Android cloud backup disabled', 'Android allowBackup must be false so health data is not copied to cloud backups.');
const gradle = existsSync('android/variables.gradle') ? read('android/variables.gradle') : '';
check(/targetSdkVersion = (3[6-9]|[4-9]\d)/.test(gradle), 'Android targets API 36+', 'Google Play requires targetSdkVersion 36 or higher.');

// 7. Things only a person can confirm.
const config = read('capacitor.config.ts');
if (config.includes("appId: 'com.ondessa.app'")) manual.push('Bundle ID is the placeholder com.ondessa.app. Confirm it matches App Store Connect and Play Console.');
manual.push('Trademark clearance for the app name (USPTO/EUIPO search by counsel).');
manual.push('Subscriptions created in App Store Connect and Play Console with IDs ondessa.membership.annual / ondessa.membership.monthly.');
manual.push('StoreKit 2 extension enabled and server receipt validation added (src/platform/purchases.ts).');
manual.push('Tested on real devices: purchase, restore, cancel, refund, reminders, Face ID, backup/restore, offline.');
manual.push('App Privacy, Data safety, age rating and Health apps declaration forms completed (docs/09-app-store-readiness.md).');

const line = (s, t) => console.log(`  ${s} ${t}`);
console.log('\nOndessa release check\n');
passed.forEach((p) => line('✓', p));
if (blockers.length) {
  console.log('\nBlocking release:');
  blockers.forEach((b) => line('✗', b));
}
console.log('\nConfirm manually before submitting:');
manual.forEach((m) => line('•', m));
console.log(`\n${blockers.length ? `NOT READY: ${blockers.length} blocker(s).` : 'Automated checks passed. Complete the manual items above.'}\n`);
process.exit(blockers.length ? 1 : 0);
