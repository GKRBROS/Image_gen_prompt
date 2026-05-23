import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import sharp from 'sharp';

import { buildAmbitionPrompt, type AmbitionGender } from '@/lib/amb_prompts';
import { mergeAmbitionImages } from '@/lib/ambitionImageProcessor';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { getOpenRouterApiKeys } from '@/lib/secrets';
import { isS3Configured, uploadBufferToS3 } from '@/lib/s3Storage';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const OPENROUTER_TIMEOUT_MS = 90000;
const OPENROUTER_MODEL = 'bytedance-seed/seedream-4.5';
const OPENROUTER_API_KEYS = getOpenRouterApiKeys();
const RETRYABLE_OPENROUTER_STATUS = new Set([429, 500, 502, 503, 504]);
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

const cleanText = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
};

const jsonResponse = (body: unknown, init?: ResponseInit) => NextResponse.json(body, init);

const buildDataUrl = async (buffer: Buffer) => {
  const resizedBuffer = await sharp(buffer).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
};

const extractGeneratedImageUrl = (result: any) => {
  return (
    result?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
    result?.choices?.[0]?.message?.content?.find?.((part: any) => part?.image_url?.url)?.image_url?.url ||
    result?.data?.[0]?.url ||
    ''
  );
};

const uploadStageToS3 = async (
  enabled: boolean,
  key: string,
  body: Buffer,
  contentType: string
) => {
  if (!enabled) {
    return null;
  }

  try {
    return await uploadBufferToS3({ key, body, contentType });
  } catch (error) {
    console.warn(`Ambition S3 upload failed for ${key}, falling back to local storage:`, error);
    return null;
  }
};

const allowedFields = ['photo', 'image', 'name', 'profession', 'outfit', 'gender'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    for (const key of formData.keys()) {
      if (!allowedFields.includes(key)) {
        return jsonResponse({ error: `Unexpected field: ${key}` }, { status: 400 });
      }
    }

    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'ambitionGeneration',
      limits: RATE_LIMITS.generate,
    });

    if (rateLimit.limited) {
      return jsonResponse(
        {
          error: 'Too many generation requests. Please wait and retry.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const photoInput = formData.get('photo') || formData.get('image');
    if (!(photoInput instanceof File)) {
      return jsonResponse({ error: 'No photo provided' }, { status: 400 });
    }

    if (!photoInput.size || photoInput.size > 10 * 1024 * 1024) {
      return jsonResponse({ error: 'Photo must be between 1 byte and 10 MB' }, { status: 400 });
    }

    const name = cleanText(formData.get('name'));
    const profession = cleanText(formData.get('profession'));
    const outfit = cleanText(formData.get('outfit'));
    const genderRaw = cleanText(formData.get('gender')).toLowerCase();
    if (genderRaw !== 'male' && genderRaw !== 'female') {
      return jsonResponse({ error: 'Gender must be male or female' }, { status: 400 });
    }
    const gender: AmbitionGender = genderRaw;

    if (!name) return jsonResponse({ error: 'Name is required' }, { status: 400 });
    if (!profession) return jsonResponse({ error: 'Profession is required' }, { status: 400 });
    if (!outfit) return jsonResponse({ error: 'Outfit is required' }, { status: 400 });

    const imageMimeType = (photoInput.type || '').toLowerCase();
    const imageExtension = (photoInput.name.split('.').pop() || '').toLowerCase();
    const isAllowedImageType = ALLOWED_IMAGE_MIME_TYPES.has(imageMimeType) || ALLOWED_IMAGE_EXTENSIONS.has(imageExtension);

    if (!isAllowedImageType) {
      return jsonResponse({ error: 'Only PNG, JPEG/JPG, or WEBP images are allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await photoInput.arrayBuffer());
    const timestamp = Date.now();
    const filename = `ambition-upload-${timestamp}.${imageExtension || 'png'}`;
    const tmpUploadsPath = join('/tmp', 'uploads');
    const publicUploadsPath = join(process.cwd(), 'public', 'uploads');

    await mkdir(tmpUploadsPath, { recursive: true }).catch(() => undefined);
    await writeFile(join(tmpUploadsPath, filename), buffer);

    const uploadedS3Url = await uploadStageToS3(
      isS3Configured(),
      `amb_upload/${filename}`,
      buffer,
      photoInput.type || 'application/octet-stream'
    );
    const uploadedImageUrl = uploadedS3Url || `/uploads/${filename}`;

    if (process.env.NODE_ENV !== 'production') {
      await mkdir(publicUploadsPath, { recursive: true }).catch(() => undefined);
      await writeFile(join(publicUploadsPath, filename), buffer).catch(() => undefined);
    }

    const dataUrl = await buildDataUrl(buffer);
    const promptText = buildAmbitionPrompt({ profession, outfit, gender });

    if (OPENROUTER_API_KEYS.length === 0) {
      throw new Error('OPENROUTER_API_KEY or OPENROUTER_API_KEYS must be configured');
    }

    let result: any = null;
    let lastOpenRouterError = 'Unknown OpenRouter error';

    for (const apiKey of OPENROUTER_API_KEYS) {
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
            model: OPENROUTER_MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: { url: dataUrl } },
                ],
              },
            ],
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
          errorDetail = contentType.includes('application/json')
            ? JSON.stringify(await apiResponse.json())
            : (await apiResponse.text()).slice(0, 300) || 'Non-JSON upstream error';
        } catch {
          errorDetail = 'Failed to parse upstream error response';
        }

        lastOpenRouterError = `Model ${OPENROUTER_MODEL} failed (${apiResponse.status}): ${errorDetail}`;

        if (!RETRYABLE_OPENROUTER_STATUS.has(apiResponse.status)) {
          break;
        }
      } catch (error: any) {
        lastOpenRouterError = error?.name === 'AbortError'
          ? `Model ${OPENROUTER_MODEL} timed out`
          : `Model ${OPENROUTER_MODEL} request failed: ${error?.message || 'Unknown request error'}`;
      } finally {
        clearTimeout(timeoutId);
      }

      if (result) {
        break;
      }
    }

    if (!result) {
      throw new Error(`OpenRouter upstream unavailable. ${lastOpenRouterError}`);
    }

    const upstreamGeneratedImageUrl = extractGeneratedImageUrl(result);
    if (!upstreamGeneratedImageUrl) {
      throw new Error('No image returned from AI');
    }

    const generatedBuffer = upstreamGeneratedImageUrl.startsWith('data:')
      ? Buffer.from(upstreamGeneratedImageUrl.split(',')[1], 'base64')
      : Buffer.from(await (await fetch(upstreamGeneratedImageUrl, { cache: 'no-store' })).arrayBuffer());

    const generatedFilename = `ambition-generated-${timestamp}.png`;
    const tmpGeneratedPath = join('/tmp', 'generated');
    await mkdir(tmpGeneratedPath, { recursive: true }).catch(() => undefined);
    const tempGeneratedFile = join(tmpGeneratedPath, generatedFilename);
    await writeFile(tempGeneratedFile, generatedBuffer);

    const generatedS3Url = await uploadStageToS3(
      isS3Configured(),
      `amb_generated/${generatedFilename}`,
      generatedBuffer,
      'image/png'
    );
    const storedGeneratedImageUrl = generatedS3Url || `/generated/${generatedFilename}`;

    if (process.env.NODE_ENV !== 'production') {
      const publicGeneratedPath = join(process.cwd(), 'public', 'generated');
      await mkdir(publicGeneratedPath, { recursive: true }).catch(() => undefined);
      await writeFile(join(publicGeneratedPath, generatedFilename), generatedBuffer).catch(() => undefined);
    }

    const finalImageUrl = await mergeAmbitionImages(tempGeneratedFile, timestamp.toString(), name, {
      s3Folder: 'amb_final',
    });

    const supabase = getSupabaseClient();
    const { error: insertError } = await supabase
      .from('ambition_generations')
      .insert({
        name,
        profession,
        outfit,
        gender,
        prompt: promptText,
        uploaded_image_url: uploadedImageUrl,
        generated_image_url: storedGeneratedImageUrl,
        final_image_url: finalImageUrl,
        generation_status: 'completed',
      });

    if (insertError) {
      console.error('Ambition generation insert error:', insertError);
      return jsonResponse({ error: 'Unable to persist ambition generation result' }, { status: 500 });
    }

    return jsonResponse({
      success: true,
      uploadedImage: uploadedImageUrl,
      generatedImage: storedGeneratedImageUrl,
      finalImageUrl,
      prompt: promptText,
      gender,
    });
  } catch (error: any) {
    console.error('CRITICAL ERROR during ambition generation:', error);

    if (error?.name === 'AbortError') {
      return jsonResponse({ error: 'Generation timed out due to upstream inactivity. Please try again with a shorter prompt or retry.' }, { status: 504 });
    }

    return jsonResponse({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}