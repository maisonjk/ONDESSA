/**
 * Business details required by the App Store and Google Play. Fill these in before
 * release; `npm run release:check` fails while any are empty.
 * Use an organisation (not personal) developer account: Apple guideline 5.1.1(ix) expects
 * health apps to be published by a legal entity.
 */
export const COMPANY = {
  /** Legal entity that publishes the app, e.g. "Ondessa Health LLC". */
  legalName: '',
  /** Support inbox shown in Help and in the store listings. */
  supportEmail: '',
  /** Public URLs for the store listings (the web build serves these pages). */
  privacyPolicyUrl: '',
  termsUrl: '',
  supportUrl: '',
};
