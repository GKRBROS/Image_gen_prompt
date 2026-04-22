import 'server-only';

import { NextRequest } from 'next/server';

type LimitRule = {
    windowMs: number;
    max: number;
};

type ScopedLimit = {
    ip: LimitRule;
    user?: LimitRule;
};

type Counter = {
    count: number;
    resetAt: number;
};

const counters = new Map<string, Counter>();

const now = () => Date.now();

const getClientIp = (request: NextRequest) => {
    const xff = request.headers.get('x-forwarded-for') || '';
    const firstForwarded = xff.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip')?.trim();
    const ip = firstForwarded || realIp || 'unknown';
    return ip.slice(0, 128);
};

const buildKey = (scope: 'ip' | 'user', endpointKey: string, identity: string) => {
    return `${scope}:${endpointKey}:${identity}`;
};

const checkRule = (key: string, rule: LimitRule) => {
    const current = now();
    const counter = counters.get(key);

    if (!counter || current >= counter.resetAt) {
        const resetAt = current + rule.windowMs;
        counters.set(key, { count: 1, resetAt });
        return {
            limited: false,
            limit: rule.max,
            remaining: Math.max(rule.max - 1, 0),
            resetAt,
        };
    }

    if (counter.count >= rule.max) {
        return {
            limited: true,
            limit: rule.max,
            remaining: 0,
            resetAt: counter.resetAt,
        };
    }

    counter.count += 1;
    counters.set(key, counter);

    return {
        limited: false,
        limit: rule.max,
        remaining: Math.max(rule.max - counter.count, 0),
        resetAt: counter.resetAt,
    };
};

const asSeconds = (ms: number) => Math.max(Math.ceil(ms / 1000), 1);

export const RATE_LIMITS: Record<string, ScopedLimit> = {
    requestOtp: {
        ip: { windowMs: 10 * 60 * 1000, max: 20 },
        user: { windowMs: 10 * 60 * 1000, max: 5 },
    },
    verifyOtp: {
        ip: { windowMs: 10 * 60 * 1000, max: 40 },
        user: { windowMs: 10 * 60 * 1000, max: 10 },
    },
    generate: {
        ip: { windowMs: 10 * 60 * 1000, max: 15 },
        user: { windowMs: 10 * 60 * 1000, max: 5 },
    },
    resetGeneration: {
        ip: { windowMs: 10 * 60 * 1000, max: 20 },
        user: { windowMs: 10 * 60 * 1000, max: 8 },
    },
    assetDownload: {
        ip: { windowMs: 60 * 1000, max: 120 },
        user: { windowMs: 60 * 1000, max: 60 },
    },
    callbackGet: {
        ip: { windowMs: 60 * 1000, max: 120 },
        user: { windowMs: 60 * 1000, max: 60 },
    },
    callbackPost: {
        ip: { windowMs: 60 * 1000, max: 60 },
        user: { windowMs: 60 * 1000, max: 30 },
    },
};

export const enforceRateLimit = (
    request: NextRequest,
    options: {
        endpointKey: string;
        limits: ScopedLimit;
        userIdentifier?: string | null;
    }
) => {
    const ip = getClientIp(request);
    const ipResult = checkRule(buildKey('ip', options.endpointKey, ip), options.limits.ip);

    const effectiveUser = options.userIdentifier?.trim() || '';
    const userResult = options.limits.user && effectiveUser
        ? checkRule(buildKey('user', options.endpointKey, effectiveUser.toLowerCase()), options.limits.user)
        : null;

    const result = userResult?.limited ? userResult : ipResult;
    const limited = Boolean(ipResult.limited || userResult?.limited);
    const retryAfterSeconds = asSeconds(result.resetAt - now());

    const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
        'Retry-After': String(retryAfterSeconds),
    };

    return {
        limited,
        retryAfterSeconds,
        headers,
    };
};
