import { sanitizeData, type AppData } from '../engine';
import { decryptJSON, encryptJSON, isEnvelope } from './crypto';

export interface BackupFile {
  app: 'ondessa';
  kind: 'plain' | 'encrypted';
  exportedOn: string;
  payload: unknown;
}

export async function makeBackup(data: AppData, today: string, password?: string): Promise<string> {
  const file: BackupFile = {
    app: 'ondessa',
    kind: password ? 'encrypted' : 'plain',
    exportedOn: today,
    payload: password ? await encryptJSON(data, password) : data,
  };
  return JSON.stringify(file, null, password ? 0 : 2);
}

export class BackupNeedsPassword extends Error {}

export async function readBackup(text: string, password?: string): Promise<AppData> {
  if (text.length > 20_000_000) throw new Error('This file is too large to be an Ondessa backup.');
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This is not an Ondessa backup file.');
  }
  if (file?.app !== 'ondessa') throw new Error('This is not an Ondessa backup file.');
  if (file.kind === 'encrypted') {
    if (!isEnvelope(file.payload)) throw new Error('This backup is damaged.');
    if (!password) throw new BackupNeedsPassword('This backup is encrypted. Enter its password.');
    return sanitizeData(await decryptJSON(file.payload, password));
  }
  return sanitizeData(file.payload);
}
