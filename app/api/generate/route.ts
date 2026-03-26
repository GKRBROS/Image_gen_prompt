import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { mergeImages } from '@/lib/imageProcessor';
import { getSupabaseClient } from '@/lib/supabase';
import { PROMPTS, GenderOption } from '@/lib/prompts';
import OpenAI from 'openai';
import sharp from 'sharp';

export const maxDuration = 120; // Allow up to 2 minutes for long AI generation
const GENERATIONS_TABLE = 'a4_generations';
const OPENROUTER_TIMEOUT_MS = 120000;
const DEFAULT_OPENROUTER_IMAGE_MODELS = ['sourceful/riverflow-v2-fast-preview'];
const OPENROUTER_IMAGE_MODELS = (process.env.OPENROUTER_IMAGE_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
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

export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const name = formData.get('name') as string;
    const customPrompt = formData.get('customPrompt') as string | null;
    const rawGender = formData.get('gender') as string | null;
    const useCustomPrompt = formData.get('useCustomPrompt') === 'true';

    const gender: GenderOption =
      rawGender === 'male' || rawGender === 'female' || rawGender === 'neutral'
        ? rawGender
        : 'neutral';

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    const imageMimeType = (image.type || '').toLowerCase();
    const imageExtension = (image.name.split('.').pop() || '').toLowerCase();
    const isAllowedImageType =
      ALLOWED_IMAGE_MIME_TYPES.has(imageMimeType) ||
      ALLOWED_IMAGE_EXTENSIONS.has(imageExtension);

    if (!isAllowedImageType) {
      return NextResponse.json(
        { error: 'Only PNG, JPEG/JPG, or WEBP images are allowed' },
        { status: 400 }
      );
    }

    // Save uploaded image temporarily for local processing
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const filename = `upload-${timestamp}.${image.name.split('.').pop()}`;

    const tmpUploadsPath = join('/tmp', 'uploads');
    const publicUploadsPath = join(process.cwd(), 'public', 'uploads');

    // Save to /tmp for intermediate processing (always works on Vercel)
    await mkdir(tmpUploadsPath, { recursive: true }).catch(() => { });
    const tempUploadFile = join(tmpUploadsPath, filename);
    await writeFile(tempUploadFile, buffer);

    // Save locally for debug/local preview (optional and non-blocking in prod)
    let uploadedImageUrl = `/uploads/${filename}`;
    if (!isProduction) {
      try {
        await mkdir(publicUploadsPath, { recursive: true }).catch(() => { });
        await writeFile(join(publicUploadsPath, filename), buffer);
      } catch (err) {
        console.warn('Could not save to public/uploads (read-only FS):', err);
      }
    }

    const supabase = getSupabaseClient();

    // Uploading the raw input is optional; skip on serverless production for speed.
    if (!SKIP_OPTIONAL_STORAGE_UPLOADS) {
      console.log('Uploading input to Supabase Storage...');
      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(`uploads/${filename}`, buffer, {
          contentType: image.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('generated-images')
          .getPublicUrl(`uploads/${filename}`);
        uploadedImageUrl = publicUrl;
      }
    }

    // Resize image for OpenRouter
    console.log('Resizing input image for OpenRouter...');
    const resizedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = resizedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const prompt = useCustomPrompt
      ? customPrompt?.trim() || ''
      : PROMPTS[gender];

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Call OpenRouter with model fallback
    console.log('Sending prompt to OpenRouter:', prompt.substring(0, 100) + '...');
    console.log('OpenRouter model candidates:', IMAGE_MODEL_CANDIDATES.join(', '));
    console.time('OpenRouter_AI_Call');

    let result: any = null;
    let lastOpenRouterError = 'Unknown OpenRouter error';

    for (const model of IMAGE_MODEL_CANDIDATES) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

      try {
        const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: dataUrl } }
                ],
              },
            ],
            modalities: ['image']
          }),
        });

        if (apiResponse.ok) {
          result = await apiResponse.json();
          console.log(`OpenRouter success with model: ${model}`);
          break;
        }

        let errorDetail = 'Unknown error';
        try {
          const contentType = apiResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await apiResponse.json();
            errorDetail = JSON.stringify(errorData);
          } else {
            const errorText = await apiResponse.text();
            errorDetail = errorText.slice(0, 300) || 'Non-JSON upstream error';
          }
        } catch (e) {
          errorDetail = 'Failed to parse upstream error response';
        }

        lastOpenRouterError = `Model ${model} failed (${apiResponse.status}): ${errorDetail}`;
        console.error('OpenRouter API Error Details:', lastOpenRouterError);

        if (!RETRYABLE_OPENROUTER_STATUS.has(apiResponse.status)) {
          break;
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          lastOpenRouterError = `Model ${model} timed out`;
        } else {
          lastOpenRouterError = `Model ${model} request failed: ${error?.message || 'Unknown request error'}`;
        }
        console.error('OpenRouter request failure:', lastOpenRouterError);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!result) {
      console.timeEnd('OpenRouter_AI_Call');
      throw new Error(`OpenRouter upstream unavailable. ${lastOpenRouterError}`);
    }

    console.timeEnd('OpenRouter_AI_Call');
    const responseMessage = result.choices[0].message;
    let generatedImageUrl: string | undefined = responseMessage.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      throw new Error('No image returned from AI');
    }

    // Process AI Image
    let imageBuffer: Buffer;
    if (generatedImageUrl.startsWith('data:')) {
      imageBuffer = Buffer.from(generatedImageUrl.split(',')[1], 'base64');
    } else {
      const imageResponse = await fetch(generatedImageUrl);
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    }

    // Save intermediate image
    const generatedFilename = `generated-${timestamp}.png`;
    let finalGeneratedUrl = `/generated/${generatedFilename}`;

    // Save to /tmp
    const tmpGeneratedPath = join('/tmp', 'generated');
    await mkdir(tmpGeneratedPath, { recursive: true }).catch(() => { });
    const tempGeneratedFile = join(tmpGeneratedPath, generatedFilename);
    await writeFile(tempGeneratedFile, imageBuffer);

    // Optional local save
    if (!isProduction) {
      try {
        const publicGeneratedPath = join(process.cwd(), 'public', 'generated');
        await mkdir(publicGeneratedPath, { recursive: true }).catch(() => { });
        await writeFile(join(publicGeneratedPath, generatedFilename), imageBuffer);
      } catch (err) {
        console.warn('Could not save to public/generated (read-only FS):', err);
      }
    }

    // Upload intermediate generated image only when not in time-constrained serverless environments.
    if (!SKIP_OPTIONAL_STORAGE_UPLOADS) {
      console.log('Uploading generated image to Supabase Storage...');
      const { error: genError } = await supabase.storage
        .from('generated-images')
        .upload(`generated/${generatedFilename}`, imageBuffer, {
          contentType: 'image/png',
          upsert: false
        });

      if (genError) {
        console.error('Supabase generated upload error:', genError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('generated-images')
          .getPublicUrl(`generated/${generatedFilename}`);
        finalGeneratedUrl = publicUrl;
      }
    }

    // Merge with background
    // Pass the /tmp path for processing
    const finalImagePath = await mergeImages(tempGeneratedFile, timestamp.toString(), name);

    // Save metadata to Supabase database
    const { data: dbData, error: dbError } = await supabase
      .from(GENERATIONS_TABLE)
      .insert({
        name: name || 'Unknown',
        designation: 'N/A',
        image_url: finalImagePath
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
    } else {
      console.log('Saved to database:', dbData);
    }

    return NextResponse.json({
      success: true,
      uploadedImage: uploadedImageUrl,
      generatedImage: finalGeneratedUrl,
      finalImage: finalImagePath,
      dbId: dbData?.id
    });
  } catch (error: any) {
    console.error('CRITICAL ERROR during generation:', error);
    // Log stack trace for Vercel logs
    if (error.stack) console.error(error.stack);

    if (error?.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Generation timed out due to upstream inactivity. Please try again with a shorter prompt or retry.'
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || 'Internal Server Error',
        details: isProduction ? undefined : error?.stack
      },
      { status: 500 }
    );
  }
}

