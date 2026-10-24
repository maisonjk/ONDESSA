import { Capacitor } from '@capacitor/core';

/**
 * Platform seam. On iOS and Android the app runs inside the Capacitor shell and uses
 * native services (file storage, local notifications, share sheet, Face ID, App Store
 * billing). On the web every function falls back to standard browser behaviour.
 * Native plugin code is loaded on demand so the web bundle stays small.
 */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
// Lets CSS swap effects that are expensive in the iOS/Android WebView (live blur, endless animations).
if (isNative && typeof document !== 'undefined') document.documentElement.classList.add('native');

export const storeName = platform === 'android' ? 'Google Play' : 'the App Store';

/** Open a link outside the app: Safari View Controller / Custom Tabs on native. */
export async function openExternal(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

/** A light tap of feedback when logging. No-op on the web. */
export function tap(): void {
  if (!isNative) return;
  void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
}

/** One-time native setup: Android back button, splash screen, status bar. */
export async function initNativeShell(): Promise<void> {
  if (!isNative) return;
  const [{ App }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ]);
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  await SplashScreen.hide().catch(() => {});
}
