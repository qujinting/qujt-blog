import type Database from 'better-sqlite3';
import { REGISTRATION_MODES, SETTINGS_KEYS, type RegistrationMode } from '@qujt/shared';

/** settings 表 value 按 JSON 编码存储（如 '"invite"'）；读取时自动解析 */
export function getSetting<T = string>(db: Database.Database, key: string): T | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as unknown as T;
  }
}

export function setSetting(db: Database.Database, key: string, value: unknown): void {
  const encoded = JSON.stringify(value);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, encoded);
}

export function getRegistrationMode(db: Database.Database): RegistrationMode {
  const v = getSetting<RegistrationMode>(db, SETTINGS_KEYS.registrationMode);
  return v && REGISTRATION_MODES.includes(v) ? v : 'invite';
}
export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  icp: string;
  registrationMode: RegistrationMode;
  commentModeration: boolean;
}

export function getSiteSettings(db: Database.Database): SiteSettings {
  return {
    siteName: getSetting(db, SETTINGS_KEYS.siteName) ?? 'qujt-blog',
    siteDescription: getSetting(db, SETTINGS_KEYS.siteDescription) ?? '',
    icp: getSetting(db, SETTINGS_KEYS.icp) ?? '',
    registrationMode: getRegistrationMode(db),
    commentModeration: (getSetting<boolean>(db, SETTINGS_KEYS.commentModeration) ?? true) === true,
  };
}

export function updateSiteSettings(db: Database.Database, patch: Partial<SiteSettings>): SiteSettings {
  if (patch.siteName !== undefined) setSetting(db, SETTINGS_KEYS.siteName, patch.siteName.trim() || 'qujt-blog');
  if (patch.siteDescription !== undefined) setSetting(db, SETTINGS_KEYS.siteDescription, patch.siteDescription ?? '');
  if (patch.icp !== undefined) setSetting(db, SETTINGS_KEYS.icp, patch.icp ?? '');
  if (patch.registrationMode !== undefined) setSetting(db, SETTINGS_KEYS.registrationMode, patch.registrationMode);
  if (patch.commentModeration !== undefined) setSetting(db, SETTINGS_KEYS.commentModeration, patch.commentModeration);
  return getSiteSettings(db);
}
