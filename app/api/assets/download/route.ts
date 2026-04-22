import { NextRequest, NextResponse } from 'next/server';

import { apiJson, applyCorsHeaders, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { validateDownloadQuery } from '@/lib/requestValidation';
import { getDownloadApiKeys, matchesAnySecret } from '@/lib/secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parseAllowedAssetHosts = () => {
    const hosts = new Set<string>([
        'frameforge.s3.ap-south-1.amazonaws.com',
    ]);

    const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
    const region = process.env.AWS_S3_REGION?.trim() || 'ap-south-1';
    if (bucket) {
        hosts.add(`${bucket}.s3.${region}.amazonaws.com`);
        hosts.add(`${bucket}.s3.amazonaws.com`);
    }

    const publicBase = process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
    if (publicBase) {
        try {
            hosts.add(new URL(publicBase).host);
        } catch {
            // Ignore invalid host values from environment.
        }
    }

    return hosts;
};

const ALLOWED_ASSET_HOSTS = parseAllowedAssetHosts();
const DOWNLOAD_API_KEYS = getDownloadApiKeys();

const sanitizeFileName = (input: string) => {
    const value = input.trim();
    if (!value) return 'frameforge-poster.png';
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
};

export async function OPTIONS(request: NextRequest) {
    return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
    const blockedOriginResponse = rejectIfOriginNotAllowed(request);
    if (blockedOriginResponse) return blockedOriginResponse;

    const parsedQuery = validateDownloadQuery(request);
    if ('error' in parsedQuery) {
        return apiJson(request, { error: parsedQuery.error }, { status: 400 });
    }

    const rateLimit = enforceRateLimit(request, {
        endpointKey: 'assetDownload',
        limits: RATE_LIMITS.assetDownload,
        userIdentifier: parsedQuery.data.apiKey || parsedQuery.data.url,
    });
    if (rateLimit.limited) {
        return apiJson(
            request,
            {
                error: 'Too many download requests. Please retry in a moment.',
                retryAfterSeconds: rateLimit.retryAfterSeconds,
            },
            { status: 429, headers: rateLimit.headers }
        );
    }

    if (DOWNLOAD_API_KEYS.length > 0) {
        const headerKey = request.headers.get('x-download-api-key')?.trim() || '';
        const queryKey = parsedQuery.data.apiKey;
        const providedKey = headerKey || queryKey;

        if (!matchesAnySecret(providedKey, DOWNLOAD_API_KEYS)) {
            return apiJson(request, { error: 'Unauthorized download key' }, { status: 401 });
        }
    }

    const rawUrl = parsedQuery.data.url;
    const download = parsedQuery.data.download;
    const requestedName = parsedQuery.data.filename;

    let targetUrl: URL;
    try {
        targetUrl = new URL(rawUrl);
    } catch {
        return apiJson(request, { error: 'Invalid url parameter' }, { status: 400 });
    }

    if (targetUrl.protocol !== 'https:') {
        return apiJson(request, { error: 'Only https asset URLs are allowed' }, { status: 400 });
    }

    if (!ALLOWED_ASSET_HOSTS.has(targetUrl.host)) {
        return apiJson(request, { error: 'Asset host is not allowed' }, { status: 403 });
    }

    try {
        const upstreamResponse = await fetch(targetUrl.toString(), {
            method: 'GET',
            cache: 'no-store',
        });

        if (!upstreamResponse.ok) {
            return apiJson(
                request,
                { error: `Failed to fetch image from storage (${upstreamResponse.status})` },
                { status: 502 }
            );
        }

        const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
        const contentLength = upstreamResponse.headers.get('content-length');
        const extension = contentType.includes('png') ? '.png' : contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.bin';
        const filename = sanitizeFileName(requestedName || `frameforge-final${extension}`);

        const response = new NextResponse(upstreamResponse.body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
                'Cache-Control': 'private, no-store, max-age=0',
            },
        });

        if (contentLength) {
            response.headers.set('Content-Length', contentLength);
        }

        return applyCorsHeaders(request, response);
    } catch (error: any) {
        console.error('Asset proxy fetch error:', error);
        return apiJson(request, { error: 'Unable to fetch image from storage' }, { status: 500 });
    }
}
