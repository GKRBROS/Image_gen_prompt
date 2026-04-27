import 'server-only';

import crypto from 'crypto';

import { PROMPTS, type GenderOption } from './prompts';

export type { GenderOption };

const OTP_SECRET = process.env.OTP_SECRET?.trim() || '';
const DEV_FALLBACK_OTP_SECRET = crypto.randomBytes(32).toString('hex');

export const IMAGE_GENERATION_TABLE = 'image_generation_requests';

/**
 * Normalizes phone number to E.164 format and validates it.
 */
export const normalizePhone = (phone: string) => {
	const cleaned = phone.trim().replace(/\s+/g, '');
	// Basic E.164 validation: starting with + followed by 10-15 digits
	if (!/^\+\d{10,15}$/.test(cleaned)) {
		throw new Error('Invalid phone number format. Please use E.164 format (e.g., +919876543210)');
	}
	return cleaned;
};

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
export const generateOtp = () => crypto.randomInt(100_000, 1_000_000).toString();

/**
 * Hashes OTP using HMAC-SHA256 with a secret salt.
 * The salt is required in production.
 */
export const hashOtp = (phone: string, otp: string) => {
	const secret = OTP_SECRET || (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_OTP_SECRET);
	if (!secret) {
		throw new Error('OTP_SECRET must be configured in production environments');
	}

	return crypto
		.createHmac('sha256', secret)
		.update(`${normalizePhone(phone)}:${otp}`)
		.digest('hex');
};

export const parseGender = (value: unknown): GenderOption => {
	return value === 'male' || value === 'female' || value === 'neutral' ? value : 'neutral';
};

export const buildGenerationPrompt = (input: {
	name: string;
	organization: string;
	gender: GenderOption;
}) => {
	return PROMPTS[input.gender] || PROMPTS.neutral;
};

export const isOtpExpired = (expiresAt: string | null) => {
	if (!expiresAt) {
		return true;
	}
	return Date.parse(expiresAt) <= Date.now();
};