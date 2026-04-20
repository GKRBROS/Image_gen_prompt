import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://frameforge.one',
  'https://www.frameforge.one',
  'https://memento.frameforge.one',
  'https://frameforge-mauve.vercel.app',
];

const parseEnvOrigins = () => {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...parseEnvOrigins()].map((origin) => {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/$/, '');
  }
}));

const ALLOW_METHODS = 'POST,OPTIONS';
const ALLOW_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];

const normalizeOrigin = (origin: string) => {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/$/, '');
  }
};

const getAllowedOrigin = (request: NextRequest) => {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) return null;

  const normalized = normalizeOrigin(requestOrigin);
  return ALLOWED_ORIGINS.has(normalized) ? normalized : null;
};

const getAllowedHeaders = (request: NextRequest) => {
  const requestedHeaders = request.headers
    .get('access-control-request-headers')
    ?.split(',')
    .map((header) => header.trim())
    .filter(Boolean) || [];

  return Array.from(new Set([...ALLOW_HEADERS, ...requestedHeaders])).join(',');
};

const applyHeaders = (request: NextRequest, response: NextResponse) => {
  const allowedOrigin = getAllowedOrigin(request);

  response.headers.set('Vary', 'Origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
    response.headers.set('Access-Control-Allow-Headers', getAllowedHeaders(request));
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
};

export const rejectIfOriginNotAllowed = (request: NextRequest) => {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) return null;

  if (getAllowedOrigin(request)) return null;

  const response = NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  return applyHeaders(request, response);
};

export const handleCorsPreflight = (request: NextRequest) => {
  const originError = rejectIfOriginNotAllowed(request);
  if (originError) return originError;

  const response = new NextResponse(null, { status: 204 });
  return applyHeaders(request, response);
};

export const apiJson = (request: NextRequest, body: unknown, init?: ResponseInit) => {
  const response = NextResponse.json(body, init);
  return applyHeaders(request, response);
};
