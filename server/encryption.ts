/**
 * Encryption Module
 *
 * Handles AES-256-GCM encryption/decryption for sensitive data at rest
 * (e.g., email credentials, API tokens).
 *
 * Security requirements (ISO 27001 A.8.24):
 * - Requires CREDENTIAL_ENCRYPTION_KEY environment variable (no fallbacks)
 * - Requires ENCRYPTION_SALT environment variable (no hardcoded salt)
 * - Uses scrypt for key derivation with proper salt
 * - AES-256-GCM provides authenticated encryption
 */

import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const salt = process.env.ENCRYPTION_SALT;
  if (!salt) {
    throw new Error(
      'ENCRYPTION_SALT environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"'
    );
  }

  _encryptionKey = crypto.scryptSync(secret, salt, 32);
  return _encryptionKey;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: enc:{iv_hex}:{authTag_hex}:{ciphertext_hex}
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string produced by encryptCredential().
 * Returns the original plaintext.
 * If the input is not in encrypted format, returns it as-is (backwards compatibility).
 */
export function decryptCredential(encryptedStr: string): string {
  if (!encryptedStr.startsWith('enc:')) {
    return encryptedStr;
  }
  const parts = encryptedStr.split(':');
  if (parts.length !== 4) {
    return encryptedStr;
  }
  const [, ivHex, authTagHex, encrypted] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
