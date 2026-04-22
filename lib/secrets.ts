import 'server-only';

import crypto from 'crypto';

const splitSecretList = (value: string) => {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const dedupe = (values: string[]) => Array.from(new Set(values));

export const getOpenRouterApiKeys = () => {
    const rotated = splitSecretList(process.env.OPENROUTER_API_KEYS || '');
    const legacy = process.env.OPENROUTER_API_KEY?.trim();
    return dedupe([...rotated, ...(legacy ? [legacy] : [])]);
};

export const getDownloadApiKeys = () => {
    const rotated = splitSecretList(process.env.DOWNLOAD_API_KEYS || '');
    const legacy = process.env.DOWNLOAD_API_KEY?.trim();
    return dedupe([...rotated, ...(legacy ? [legacy] : [])]);
};

const toBuffer = (value: string) => Buffer.from(value, 'utf8');

export const safeSecretEquals = (left: string, right: string) => {
    const leftBuffer = toBuffer(left);
    const rightBuffer = toBuffer(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const matchesAnySecret = (candidate: string, secrets: string[]) => {
    if (!candidate || secrets.length === 0) return false;
    return secrets.some((secret) => safeSecretEquals(candidate, secret));
};
