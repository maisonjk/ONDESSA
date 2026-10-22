import { isNative } from '../platform';

/**
 * Appearance: follow the device, or force light or dark. A display preference only, kept
 * in local storage on this device; it says nothing about health.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'ondessa.theme';

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice = getTheme()): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  if (!isNative) return;
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  void import('@capacitor/status-bar').then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })).catch(() => {});
}

export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage unavailable: the choice lasts for this session */
  }
  applyTheme(choice);
}
