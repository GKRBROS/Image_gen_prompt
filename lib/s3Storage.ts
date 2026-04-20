import 'server-only';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const AWS_S3_REGION = process.env.AWS_S3_REGION?.trim() || process.env.AWS_REGION?.trim() || '';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
const RAW_BUCKET_VALUE = process.env.AWS_S3_BUCKET?.trim() || process.env.BUCKET_NAME?.trim() || '';
const EXPLICIT_KEY_PREFIX = process.env.AWS_S3_KEY_PREFIX?.trim() || '';
const PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL?.trim() || '';
const S3_SIGNED_URL_EXPIRES_SEC_RAW = Number(process.env.AWS_S3_SIGNED_URL_EXPIRES_SEC || '86400');
const S3_SIGNED_URL_EXPIRES_SEC = Number.isFinite(S3_SIGNED_URL_EXPIRES_SEC_RAW)
  ? Math.min(Math.max(Math.floor(S3_SIGNED_URL_EXPIRES_SEC_RAW), 1), 604800)
  : 86400;
const USE_PRESIGNED_URLS = (process.env.AWS_S3_USE_PRESIGNED_URLS || 'true').toLowerCase() === 'true';

const [bucketFromPath, ...pathPrefixParts] = RAW_BUCKET_VALUE.split('/').filter(Boolean);
const BUCKET_NAME = bucketFromPath || '';
const KEY_PREFIX = (EXPLICIT_KEY_PREFIX || pathPrefixParts.join('/')).replace(/^\/+|\/+$/g, '');

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
};

export const isS3Configured = () => {
  const bucketLooksReal =
    Boolean(BUCKET_NAME) &&
    !/^your[-_]?s3[-_]?bucket[-_]?name$/i.test(BUCKET_NAME) &&
    !/^example/i.test(BUCKET_NAME) &&
    !BUCKET_NAME.includes('/') &&
    /^[a-z0-9.-]{3,63}$/.test(BUCKET_NAME);

  return Boolean(AWS_S3_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && bucketLooksReal);
};

const encodeKeyForUrl = (key: string) =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const resolveKey = (key: string) => {
  const normalizedKey = key.replace(/^\/+/, '');
  return KEY_PREFIX ? `${KEY_PREFIX}/${normalizedKey}` : normalizedKey;
};

const getPublicUrl = (key: string) => {
  if (PUBLIC_BASE_URL) {
    return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodeKeyForUrl(key)}`;
  }

  return `https://${BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${encodeKeyForUrl(key)}`;
};

export const getObjectAccessUrl = async (key: string, expiresInSec = S3_SIGNED_URL_EXPIRES_SEC) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured. Set AWS_S3_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
  }

  const resolvedKey = resolveKey(key);

  // Use signed URLs by default so preview/download works for private buckets.
  if (USE_PRESIGNED_URLS || !PUBLIC_BASE_URL) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: resolvedKey,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSec });
  }

  return getPublicUrl(resolvedKey);
};

export const uploadBufferToS3 = async (input: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured. Set AWS_S3_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
  }

  const resolvedKey = resolveKey(input.key);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: resolvedKey,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl || 'public,max-age=31536000,immutable',
    })
  );

  return getObjectAccessUrl(input.key);
};
