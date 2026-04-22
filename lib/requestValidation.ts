import 'server-only';

import { NextRequest } from 'next/server';

import type { GenderOption } from '@/lib/generationFlow';

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = (value: string) => value.replace(CONTROL_CHARS, '').trim();

const assertKnownFields = (input: Record<string, unknown>, allowed: string[]) => {
    const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
        return `Unexpected field(s): ${unknown.join(', ')}`;
    }
    return null;
};

const asRecord = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
};

const requireEmail = (value: unknown) => {
    if (typeof value !== 'string') return { error: 'Email is required' as const };
    const email = cleanText(value).toLowerCase();
    if (!email) return { error: 'Email is required' as const };
    if (email.length > 254) return { error: 'Email is too long' as const };
    if (!EMAIL_REGEX.test(email)) return { error: 'Invalid email format' as const };
    return { email };
};

const optionalId = (value: unknown, label: string) => {
    if (value == null || value === '') return { value: '' };
    if (typeof value !== 'string') return { error: `${label} must be a string` as const };
    const normalized = cleanText(value);
    if (normalized.length > 128) return { error: `${label} is too long` as const };
    if (!/^[a-zA-Z0-9-]+$/.test(normalized)) return { error: `${label} format is invalid` as const };
    return { value: normalized };
};

const requiredText = (value: unknown, label: string, min: number, max: number) => {
    if (typeof value !== 'string') return { error: `${label} is required` as const };
    const normalized = cleanText(value);
    if (normalized.length < min) return { error: `${label} is required` as const };
    if (normalized.length > max) return { error: `${label} is too long` as const };
    return { value: normalized };
};

export const parseStrictJson = async (request: NextRequest) => {
    const body = await request.json().catch(() => null);
    return asRecord(body);
};

export const validateRequestOtpInput = (input: unknown) => {
    const data = asRecord(input);
    if (!data) return { error: 'Invalid JSON payload' };

    const unknownError = assertKnownFields(data, ['email']);
    if (unknownError) return { error: unknownError };

    const emailResult = requireEmail(data.email);
    if ('error' in emailResult) return { error: emailResult.error };

    return { data: { email: emailResult.email } };
};

export const validateVerifyOtpInput = (input: unknown) => {
    const data = asRecord(input);
    if (!data) return { error: 'Invalid JSON payload' };

    const unknownError = assertKnownFields(data, ['email', 'otp']);
    if (unknownError) return { error: unknownError };

    const emailResult = requireEmail(data.email);
    if ('error' in emailResult) return { error: emailResult.error };

    const otp = typeof data.otp === 'string' ? cleanText(data.otp) : '';
    if (!/^\d{6}$/.test(otp)) {
        return { error: 'Enter the 6-digit verification code' };
    }

    return { data: { email: emailResult.email, otp } };
};

export const validateResetInput = (input: unknown) => {
    const data = asRecord(input);
    if (!data) return { error: 'Invalid JSON payload' };

    const unknownError = assertKnownFields(data, ['email', 'requestId']);
    if (unknownError) return { error: unknownError };

    const emailResult = requireEmail(data.email);
    if ('error' in emailResult) return { error: emailResult.error };

    const requestIdResult = optionalId(data.requestId, 'requestId');
    if ('error' in requestIdResult) return { error: requestIdResult.error };

    return { data: { email: emailResult.email, requestId: requestIdResult.value } };
};

export const validateGenerateFormData = (formData: FormData) => {
    const allowedFields = ['photo', 'image', 'email', 'requestId', 'name', 'organization', 'gender'];
    for (const key of formData.keys()) {
        if (!allowedFields.includes(key)) {
            return { error: `Unexpected field: ${key}` };
        }
    }

    const fileInput = formData.get('photo') || formData.get('image');
    if (!(fileInput instanceof File)) {
        return { error: 'No photo provided' };
    }

    if (!fileInput.size || fileInput.size > 10 * 1024 * 1024) {
        return { error: 'Photo must be between 1 byte and 10 MB' };
    }

    const emailResult = requireEmail(formData.get('email'));
    if ('error' in emailResult) return { error: emailResult.error };

    const requestIdResult = optionalId(formData.get('requestId'), 'requestId');
    if ('error' in requestIdResult) return { error: requestIdResult.error };

    const nameResult = requiredText(formData.get('name'), 'Name', 1, 100);
    if ('error' in nameResult) return { error: nameResult.error };

    const orgResult = requiredText(formData.get('organization'), 'Organization', 1, 120);
    if ('error' in orgResult) return { error: orgResult.error };

    const genderRaw = typeof formData.get('gender') === 'string' ? cleanText(String(formData.get('gender'))).toLowerCase() : 'neutral';
    const gender = (genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'neutral') ? genderRaw : 'neutral';

    return {
        data: {
            photo: fileInput,
            email: emailResult.email,
            requestId: requestIdResult.value,
            name: nameResult.value,
            organization: orgResult.value,
            gender: gender as GenderOption,
        },
    };
};

export const validateDownloadQuery = (request: NextRequest) => {
    const params = request.nextUrl.searchParams;
    const allowed = new Set(['url', 'download', 'filename', 'apiKey']);

    for (const key of params.keys()) {
        if (!allowed.has(key)) {
            return { error: `Unexpected query parameter: ${key}` };
        }
    }

    const url = cleanText(params.get('url') || '');
    const download = params.get('download') === '1';
    const filename = cleanText(params.get('filename') || '');
    const apiKey = cleanText(params.get('apiKey') || '');

    if (!url) return { error: 'url query parameter is required' };
    if (filename.length > 120) return { error: 'filename is too long' };

    return { data: { url, download, filename, apiKey } };
};

export const validateCallbackJobId = (value: string | null) => {
    const normalized = cleanText(value || '');
    if (!normalized) return { error: 'Job ID not provided' };
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(normalized)) return { error: 'Invalid job ID format' };
    return { data: normalized };
};

export const validateCallbackBody = (input: unknown) => {
    const data = asRecord(input);
    if (!data) return { error: 'Invalid JSON payload' };

    const unknownError = assertKnownFields(data, ['status', 'output']);
    if (unknownError) return { error: unknownError };

    const status = typeof data.status === 'string' ? cleanText(data.status) : 'completed';

    let output: { image_url?: string } | string[] | null = null;
    if (data.output != null) {
        if (Array.isArray(data.output)) {
            const values = data.output.filter((item) => typeof item === 'string').map((item) => cleanText(item as string));
            output = values;
        } else if (typeof data.output === 'object') {
            const outputObj = data.output as Record<string, unknown>;
            const outputUnknown = assertKnownFields(outputObj, ['image_url']);
            if (outputUnknown) return { error: outputUnknown };
            const imageUrl = typeof outputObj.image_url === 'string' ? cleanText(outputObj.image_url) : '';
            output = imageUrl ? { image_url: imageUrl } : {};
        } else {
            return { error: 'Invalid callback output format' };
        }
    }

    return { data: { status, output } };
};
