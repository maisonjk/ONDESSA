/**
 * Business details required by the App Store and Google Play. `npm run release:check`
 * fails while any are empty. Published by a sole proprietor (individual developer account);
 * if App Review asks for a legal entity under guideline 5.1.1(ix), form one and update here.
 */
export const COMPANY = {
  /** Who publishes and operates the app. */
  legalName: 'Jiae Kim',
  /** Registered fictitious business name (DBA), if any, e.g. 'Ondessa'. Shown as "doing business as". */
  dba: '',
  /** Support inbox shown in Help and in the store listings. */
  supportEmail: 'innerlink24@gmail.com',
  /** Public URLs for the store listings (the web build serves these pages). */
  privacyPolicyUrl: '',
  termsUrl: '',
  supportUrl: '',
};

/** "Jiae Kim" or "Jiae Kim, doing business as Ondessa" when a DBA is registered. */
export const OPERATOR = COMPANY.dba ? `${COMPANY.legalName}, doing business as ${COMPANY.dba}` : COMPANY.legalName;
