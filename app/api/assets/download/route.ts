import { NextRequest, NextResponse } from 'next/server';

import { apiJson, applyCorsHeaders, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';

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
const DOWNLOAD_API_KEY = process.env.DOWNLOAD_API_KEY?.trim() || '';

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

    if (DOWNLOAD_API_KEY) {
        const headerKey = request.headers.get('x-download-api-key')?.trim() || '';
        const queryKey = request.nextUrl.searchParams.get('apiKey')?.trim() || '';
        const providedKey = headerKey || queryKey;

        if (!providedKey || providedKey !== DOWNLOAD_API_KEY) {
            return apiJson(request, { error: 'Unauthorized download key' }, { status: 401 });
        }
    }

    const rawUrl = request.nextUrl.searchParams.get('url') || '';
    const download = request.nextUrl.searchParams.get('download') === '1';
    const requestedName = request.nextUrl.searchParams.get('filename') || '';

    if (!rawUrl) {
        return apiJson(request, { error: 'url query parameter is required' }, { status: 400 });
    }

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
