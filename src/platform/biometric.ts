import { isNative } from './index';

/**
 * Face ID / Touch ID / fingerprint unlock. When enabled, the passcode is kept in the
 * device keychain (this device only, never synced to iCloud) and released only after a
 * successful biometric check. Turning it off, changing the passcode or erasing the app
 * removes it. Not available on the web.
 */
const KEY = 'ondessa.unlock';

export async function biometryAvailable(): Promise<{ available: boolean; label: string }> {
  if (!isNative) return { available: false, label: '' };
  const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth');
  const r = await BiometricAuth.checkBiometry();
  const label =
    r.biometryType === BiometryType.faceId ? 'Face ID'
      : r.biometryType === BiometryType.touchId ? 'Touch ID'
        : 'biometrics';
  return { available: r.isAvailable, label };
}

async function storage() {
  const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage');
  return { SecureStorage, KeychainAccess };
}

export async function enableBiometricUnlock(passcode: string): Promise<boolean> {
  if (!isNative) return false;
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  try {
    await BiometricAuth.authenticate({ reason: 'Turn on quick unlock for Ondessa', allowDeviceCredential: false });
  } catch {
    return false;
  }
  const { SecureStorage, KeychainAccess } = await storage();
  await SecureStorage.set(KEY, passcode, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  return true;
}

export async function biometricUnlockEnabled(): Promise<boolean> {
  if (!isNative) return false;
  const { SecureStorage } = await storage();
  return (await SecureStorage.keys(false).catch(() => [] as string[])).includes(KEY);
}

/** Returns the stored passcode after a successful biometric check, otherwise undefined. */
export async function biometricPasscode(): Promise<string | undefined> {
  if (!isNative) return undefined;
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  try {
    await BiometricAuth.authenticate({ reason: 'Unlock Ondessa', allowDeviceCredential: false, iosFallbackTitle: 'Use passcode' });
  } catch {
    return undefined;
  }
  const { SecureStorage } = await storage();
  const v = await SecureStorage.get(KEY, false, false).catch(() => null);
  return typeof v === 'string' ? v : undefined;
}

export async function disableBiometricUnlock(): Promise<void> {
  if (!isNative) return;
  const { SecureStorage } = await storage();
  await SecureStorage.remove(KEY, false).catch(() => false);
}
