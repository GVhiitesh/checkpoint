import crypto from 'crypto';
import { config } from './config.js';

export const MAX_OFFLINE_SYNC_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function currentWindow(now = Date.now()) {
  return Math.floor(now / config.qrWindowMs);
}

function sign(registrationId, windowIndex) {
  return crypto
    .createHmac('sha256', config.qrHmacSecret)
    .update(`${registrationId}:${windowIndex}`)
    .digest('hex')
    .slice(0, 32);
}

export function deriveShortCode(registrationId, windowIndex) {
  const hash = crypto
    .createHmac('sha256', config.qrHmacSecret)
    .update(`short:${registrationId}:${windowIndex}`)
    .digest('hex');
  return hash.slice(0, 5).toUpperCase();
}

export function issueToken(registrationId, now = Date.now()) {
  const w = currentWindow(now);
  return `${registrationId}.${w}.${sign(registrationId, w)}`;
}

export function verifyToken(token, opts = {}) {
  if (typeof token !== 'string') {
    return { ok: false, reason: 'invalid_token' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid_token' };
  }
  const [registrationId, windowStr, sig] = parts;
  const w = parseInt(windowStr, 10);
  if (!registrationId || Number.isNaN(w)) {
    return { ok: false, reason: 'invalid_token' };
  }

  let referenceTime = Date.now();
  let isOffline = false;
  let maxOfflineAgeMs = MAX_OFFLINE_SYNC_AGE_MS;

  if (typeof opts === 'number') {
    referenceTime = opts;
  } else if (typeof opts === 'object' && opts !== null) {
    if (opts.referenceTime !== undefined) referenceTime = opts.referenceTime;
    else if (opts.now !== undefined) referenceTime = opts.now;
    if (opts.isOffline !== undefined) isOffline = Boolean(opts.isOffline);
    if (opts.maxOfflineAgeMs !== undefined) maxOfflineAgeMs = opts.maxOfflineAgeMs;
  }

  const serverNow = Date.now();
  const scanTime = typeof referenceTime === 'number' ? referenceTime : Date.parse(referenceTime);
  if (Number.isNaN(scanTime)) {
    return { ok: false, reason: 'invalid_token' };
  }

  // Prevent tokens claiming to be scanned in the future (allowing 60s max clock skew)
  if (scanTime > serverNow + 60_000) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (isOffline) {
    // Offline scans must not exceed maximum sync age threshold
    if (serverNow - scanTime > maxOfflineAgeMs) {
      return { ok: false, reason: 'expired_token' };
    }
  }

  // Token window index must match reference window
  const expectedWindow = currentWindow(scanTime);
  if (w !== expectedWindow && w !== expectedWindow - 1) {
    return { ok: false, reason: 'expired_token' };
  }

  const expectedSig = sign(registrationId, w);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid_token' };
  }

  return { ok: true, registrationId };
}
