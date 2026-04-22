import 'server-only';

import crypto from 'crypto';

import { PROMPTS, type GenderOption } from './prompts';

export type { GenderOption };

const OTP_SECRET = process.env.OTP_SECRET?.trim() || '';
const DEV_FALLBACK_OTP_SECRET = crypto.randomBytes(32).toString('hex');

export const IMAGE_GENERATION_TABLE = 'image_generation_requests';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

export const hashOtp = (email: string, otp: string) => {
	const secret = OTP_SECRET || (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_OTP_SECRET);
	if (!secret) {
		throw new Error('OTP_SECRET must be configured in production environments');
	}

	return crypto
		.createHash('sha256')
		.update(`${normalizeEmail(email)}:${otp}:${secret}`)
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