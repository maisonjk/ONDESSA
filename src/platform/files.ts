import { isNative } from './index';

/**
 * Durable storage for the vault record on native: one JSON file in the app's private
 * Library folder, written atomically (temp file, then rename). Unlike WebView storage it
 * is never evicted by the system. Not used on the web.
 */
const DIR = 'Ondessa';
const FILE = `${DIR}/vault.json`;
const TMP = `${DIR}/vault.tmp`;

async function fs() {
  const m = await import('@capacitor/filesystem');
  return { ...m, dir: m.Directory.Library };
}

export async function readVaultFile(): Promise<string | undefined> {
  const { Filesystem, Encoding, dir } = await fs();
  try {
    const r = await Filesystem.readFile({ path: FILE, directory: dir, encoding: Encoding.UTF8 });
    return typeof r.data === 'string' ? r.data : undefined;
  } catch {
    return undefined; // no file yet
  }
}

export async function writeVaultFile(text: string): Promise<void> {
  const { Filesystem, Encoding, dir } = await fs();
  await Filesystem.writeFile({ path: TMP, data: text, directory: dir, encoding: Encoding.UTF8, recursive: true });
  await Filesystem.rename({ from: TMP, to: FILE, directory: dir, toDirectory: dir });
}

export async function deleteVaultFile(): Promise<void> {
  const { Filesystem, dir } = await fs();
  for (const path of [FILE, TMP]) {
    await Filesystem.deleteFile({ path, directory: dir }).catch(() => {});
  }
}

/**
 * Hand a backup to the system share sheet (Files, AirDrop, email...). Resolves true only
 * if the user completed the share, so "last backup" is never recorded for a cancelled one.
 * The temporary copy is deleted afterwards either way.
 */
export async function shareBackupFile(name: string, text: string): Promise<boolean> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const written = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: 'Ondessa backup', files: [written.uri] });
    return true;
  } catch {
    return false; // cancelled
  } finally {
    await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
  }
}

/** Web: trigger a normal file download. Returns true once the download was started. */
export function downloadFile(name: string, text: string): boolean {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  return true;
}

export async function exportBackup(name: string, text: string): Promise<boolean> {
  return isNative ? shareBackupFile(name, text) : downloadFile(name, text);
}
