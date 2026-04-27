import 'server-only';

import crypto from 'crypto';

const OTP_SECRET = process.env.OTP_SECRET || 'fallback-dev-secret-not-for-production';

/**
 * Generates a secure 6-digit numeric OTP.
 */
export const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes an OTP using HMAC-SHA256 with the secret key.
 * This satisfies the "Hash OTPs using HMAC-SHA256 with a salt before storing them" requirement.
 * In this case, the OTP_SECRET acts as the salt/key.
 */
export const hashOtp = (otp: string): string => {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(otp)
    .digest('hex');
};

/**
 * Verifies an OTP against its stored hash using a timing-safe comparison.
 */
export const verifyOtpHash = (otp: string, storedHash: string): boolean => {
  const currentHash = hashOtp(otp);
  
  // Convert to buffers for timingSafeEqual
  const currentBuffer = Buffer.from(currentHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  // Length check is important before timingSafeEqual
  if (currentBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(currentBuffer, storedBuffer);
};

/**
 * Validates E.164 phone number format.
 */
export const isValidPhone = (phone: string): boolean => {
  // Simple E.164 regex: + followed by 7 to 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phone);
};
