import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import sharp from 'sharp';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { mergeImages } from '@/lib/imageProcessor';
import {
  buildGenerationPrompt,
  GenderOption,
  IMAGE_GENERATION_TABLE,
} from '@/lib/generationFlow';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { validateGenerateFormData } from '@/lib/requestValidation';
import { getOpenRouterApiKeys } from '@/lib/secrets';
import { isS3Configured, uploadBufferToS3 } from '@/lib/s3Storage';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

const OPENROUTER_TIMEOUT_MS = 120000;
const DEFAULT_OPENROUTER_IMAGE_MODELS = ['sourceful/riverflow-v2-fast-preview'];
const OPENROUTER_IMAGE_MODELS = (process.env.OPENROUTER_IMAGE_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const OPENROUTER_API_KEYS = getOpenRouterApiKeys();
const IMAGE_MODEL_CANDIDATES = OPENROUTER_IMAGE_MODELS.length
  ? OPENROUTER_IMAGE_MODELS
  : DEFAULT_OPENROUTER_IMAGE_MODELS;
const RETRYABLE_OPENROUTER_STATUS = new Set([429, 500, 502, 503, 504]);
const SKIP_OPTIONAL_STORAGE_UPLOADS = process.env.NETLIFY === 'true' || process.env.NODE_ENV === 'production';
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

const buildFinalImageUrl = (request: NextRequest, finalImagePath: string) => {
  const origin = request.nextUrl.origin;

  if (!finalImagePath) return '';

  if (finalImagePath.startsWith('http')) {
    try {
      const parsed = new URL(finalImagePath);
      const isS3Host = parsed.host.includes('.amazonaws.com');
      if (isS3Host) {
        return `${origin}/api/assets/download?url=${encodeURIComponent(finalImagePath)}`;
      }
    } catch {
      return finalImagePath;
    }
    return finalImagePath;
  }

  return `${origin}${finalImagePath.startsWith('/') ? '' : '/'}${finalImagePath}`;
};

export async function POST(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  const isProduction = process.env.NODE_ENV === 'production';

  try {
    const formData = await request.formData();
    const prevalidatedEmail = typeof formData.get('email') === 'string' ? String(formData.get('email')) : '';
    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'generate',
      limits: RATE_LIMITS.generate,
      userIdentifier: prevalidatedEmail,
    });
    if (rateLimit.limited) {
      return apiJson(
        request,
        {
          error: 'Too many generation requests. Please wait and retry.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const validated = validateGenerateFormData(formData);
    if ('error' in validated) {
      return apiJson(request, { error: validated.error }, { status: 400 });
    }

    const { photo, email, requestId, name, organization, gender } = validated.data;

    const supabase = getSupabaseClient();

    const requestSelect = 'id, is_verified';
    const requestQuery = supabase
      .from(IMAGE_GENERATION_TABLE)
      .select(requestSelect)
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: requestRows, error: requestError } = await requestQuery;
    const requestRow = requestRows?.[0] || null;

    if (!requestId && !requestRow) {
      return apiJson(request, { error: 'No verified request found for this email' }, { status: 404 });
    }

    const resolvedRequestId = requestId || requestRow?.id || '';

    const { data: validatedRequestRow, error: validatedRequestError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .select('id, is_verified')
      .eq('email', email)
      .eq('id', resolvedRequestId)
      .maybeSingle();

    if (requestError || validatedRequestError) {
      console.error('Generate request lookup error:', requestError || validatedRequestError);
      return apiJson(request, { error: 'Unable to validate session' }, { status: 500 });
    }
    if (!validatedRequestRow) return apiJson(request, { error: 'No matching verified request found' }, { status: 404 });
    if (!validatedRequestRow.is_verified) return apiJson(request, { error: 'Email is not verified yet' }, { status: 403 });

    const imageMimeType = (photo.type || '').toLowerCase();
    const imageExtension = (photo.name.split('.').pop() || '').toLowerCase();
    const isAllowedImageType = ALLOWED_IMAGE_MIME_TYPES.has(imageMimeType) || ALLOWED_IMAGE_EXTENSIONS.has(imageExtension);
    if (!isAllowedImageType) {
      return apiJson(request, { error: 'Only PNG, JPEG/JPG, or WEBP images are allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const timestamp = Date.now();
    const filename = `upload-${timestamp}.${imageExtension || 'png'}`;

    const tmpUploadsPath = join('/tmp', 'uploads');
    const publicUploadsPath = join(process.cwd(), 'public', 'uploads');
    await mkdir(tmpUploadsPath, { recursive: true }).catch(() => undefined);
    await writeFile(join(tmpUploadsPath, filename), buffer);

    let uploadedImageUrl = `/uploads/${filename}`;
    if (!isProduction) {
      try {
        await mkdir(publicUploadsPath, { recursive: true }).catch(() => undefined);
        await writeFile(join(publicUploadsPath, filename), buffer);
      } catch { }
    }

    if (isS3Configured()) {
      try {
        uploadedImageUrl = await uploadBufferToS3({
          key: `uploads/${filename}`,
          body: buffer,
          contentType: photo.type || 'application/octet-stream',
        });
      } catch (s3Error) {
        console.warn('S3 upload failed, falling back to Supabase storage for original upload:', s3Error);
      }
    }

    if (uploadedImageUrl.startsWith('/uploads/') && !SKIP_OPTIONAL_STORAGE_UPLOADS) {
      const { error: uploadError } = await supabase.storage.from('generated-images').upload(`uploads/${filename}`, buffer, {
        contentType: photo.type,
        upsert: false,
      });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('generated-images').getPublicUrl(`uploads/${filename}`);
        uploadedImageUrl = publicUrl;
      }
    }

    const resizedBuffer = await sharp(buffer).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const dataUrl = `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
    const prompt = buildGenerationPrompt({ name, organization, gender });

    if (OPENROUTER_API_KEYS.length === 0) throw new Error('OPENROUTER_API_KEY or OPENROUTER_API_KEYS must be configured');

    let result: any = null;
    let lastOpenRouterError = 'Unknown OpenRouter error';

    for (const apiKey of OPENROUTER_API_KEYS) {
      for (const model of IMAGE_MODEL_CANDIDATES) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
        try {
          const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
              modalities: ['image'],
            }),
          });
          if (apiResponse.ok) {
            result = await apiResponse.json();
            break;
          }
          let errorDetail = 'Unknown error';
          try {
            const contentType = apiResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json')) errorDetail = JSON.stringify(await apiResponse.json());
            else errorDetail = (await apiResponse.text()).slice(0, 300) || 'Non-JSON upstream error';
          } catch {
            errorDetail = 'Failed to parse upstream error response';
          }
          lastOpenRouterError = `Model ${model} failed (${apiResponse.status}): ${errorDetail}`;
          if (!RETRYABLE_OPENROUTER_STATUS.has(apiResponse.status)) break;
        } catch (error: any) {
          lastOpenRouterError = error?.name === 'AbortError' ? `Model ${model} timed out` : `Model ${model} request failed: ${error?.message || 'Unknown request error'}`;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (result) {
        break;
      }
    }

    if (!result) throw new Error(`OpenRouter upstream unavailable. ${lastOpenRouterError}`);

    const generatedImageUrl: string | undefined = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!generatedImageUrl) throw new Error('No image returned from AI');

    const imageBuffer = generatedImageUrl.startsWith('data:')
      ? Buffer.from(generatedImageUrl.split(',')[1], 'base64')
      : Buffer.from(await (await fetch(generatedImageUrl, { cache: 'no-store' })).arrayBuffer());

    const generatedFilename = `generated-${timestamp}.png`;
    let finalGeneratedUrl = `/generated/${generatedFilename}`;
    const tmpGeneratedPath = join('/tmp', 'generated');
    await mkdir(tmpGeneratedPath, { recursive: true }).catch(() => undefined);
    const tempGeneratedFile = join(tmpGeneratedPath, generatedFilename);
    await writeFile(tempGeneratedFile, imageBuffer);

    if (!isProduction) {
      try {
        const publicGeneratedPath = join(process.cwd(), 'public', 'generated');
        await mkdir(publicGeneratedPath, { recursive: true }).catch(() => undefined);
        await writeFile(join(publicGeneratedPath, generatedFilename), imageBuffer);
      } catch { }
    }

    if (isS3Configured()) {
      try {
        finalGeneratedUrl = await uploadBufferToS3({
          key: `generated/${generatedFilename}`,
          body: imageBuffer,
          contentType: 'image/png',
        });
      } catch (s3Error) {
        console.warn('S3 upload failed, falling back to Supabase storage for generated image:', s3Error);
      }
    }

    if (finalGeneratedUrl.startsWith('/generated/') && !SKIP_OPTIONAL_STORAGE_UPLOADS) {
      const { error: genError } = await supabase.storage.from('generated-images').upload(`generated/${generatedFilename}`, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      });
      if (!genError) {
        const { data: { publicUrl } } = supabase.storage.from('generated-images').getPublicUrl(`generated/${generatedFilename}`);
        finalGeneratedUrl = publicUrl;
      }
    }

    const finalImagePath = await mergeImages(tempGeneratedFile, timestamp.toString(), name);
    const finalImageUrl = buildFinalImageUrl(request, finalImagePath);

    const { data: dbData, error: dbError } = await supabase
      .from(IMAGE_GENERATION_TABLE)
      .update({
        name,
        organization,
        gender,
        prompt_used: prompt,
        photo_url: uploadedImageUrl,
        generated_image_url: finalGeneratedUrl,
        final_image_url: finalImagePath,
        generation_status: 'completed',
        generated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('email', email)
      .eq('id', validatedRequestRow.id)
      .select('id, email, final_image_url')
      .single();

    if (dbError) {
      console.error('Database update error:', dbError);
      return apiJson(request, { error: 'Unable to persist generation result' }, { status: 500 });
    }

    return apiJson(request, {
      success: true,
      uploadedImage: uploadedImageUrl,
      generatedImage: finalGeneratedUrl,
      finalImage: finalImagePath,
      finalImageUrl,
      dbId: dbData?.id,
      requestId: validatedRequestRow.id,
      prompt,
    });
  } catch (error: any) {
    console.error('CRITICAL ERROR during generation:', error);
    if (error?.name === 'AbortError') {
      return apiJson(request, { error: 'Generation timed out due to upstream inactivity. Please try again with a shorter prompt or retry.' }, { status: 504 });
    }
    return apiJson(request, { error: 'Internal Server Error' }, { status: 500 });
  }
}
