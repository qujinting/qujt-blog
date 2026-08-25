import crypto from 'node:crypto';

// 邀请码字母表：去掉易混淆的 0/O/1/I
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 10, prefix = ''): string {
  const bytes = crypto.randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) {
    s += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  }
  return prefix ? prefix.toUpperCase() + s : s;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
