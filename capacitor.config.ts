import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell for the App Store and Google Play. The web app is bundled inside the
 * binary (webDir), never loaded from a remote server, so the app works offline and
 * no health data ever depends on a network origin.
 * The bundle identifier is a placeholder until the name clears trademark review.
 */
const config: CapacitorConfig = {
  appId: 'com.ondessa.app',
  appName: 'Ondessa',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#f3f1f6' },
    LocalNotifications: { iconColor: '#c83c61' },
  },
};

export default config;
