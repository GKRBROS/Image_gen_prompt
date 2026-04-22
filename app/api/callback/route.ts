import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { apiJson, handleCorsPreflight, rejectIfOriginNotAllowed } from '@/lib/apiSecurity';
import { mergeImages } from '@/lib/imageProcessor';
import { jobStore } from '@/lib/jobStore';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rateLimit';
import { validateCallbackBody, validateCallbackJobId } from '@/lib/requestValidation';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawJobId = searchParams.get('jobId');

    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'callbackPost',
      limits: RATE_LIMITS.callbackPost,
      userIdentifier: rawJobId,
    });
    if (rateLimit.limited) {
      return apiJson(
        request,
        {
          error: 'Too many callback requests. Try again later.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const jobIdResult = validateCallbackJobId(rawJobId);
    if ('error' in jobIdResult) {
      return apiJson(request, { error: jobIdResult.error }, { status: 400 });
    }
    const jobId = jobIdResult.data;

    console.log(`POST /api/callback called with jobId: ${jobId}`);

    const bodyRaw = await request.json().catch(() => null);
    const bodyValidated = validateCallbackBody(bodyRaw);
    if ('error' in bodyValidated) {
      return apiJson(request, { error: bodyValidated.error }, { status: 400 });
    }
    const body = bodyValidated.data;

    // Update job status in store
    const job = jobStore.get(jobId);
    if (job) {
      job.status = body.status || 'completed';
      job.result = body;
    }

    console.log(`Callback received for job ${jobId}:`, body);

    // If generation is complete, process the result
    if (body.status === 'SUCCESS' && body.output) {
      const generatedImageUrl = Array.isArray(body.output)
        ? body.output[0]
        : body.output.image_url;

      if (generatedImageUrl) {
        try {
          // Download the generated image
          const imageResponse = await fetch(generatedImageUrl);
          if (!imageResponse.ok) {
            throw new Error('Failed to fetch generated image');
          }

          const generatedBuffer = Buffer.from(
            await imageResponse.arrayBuffer()
          );

          // Save generated image
          const timestamp = Date.now();
          const generatedFilename = `generated-${timestamp}.png`;
          const generatedDir = join(process.cwd(), 'public', 'generated');
          await mkdir(generatedDir, { recursive: true });

          const generatedFilepath = join(generatedDir, generatedFilename);
          await writeFile(generatedFilepath, generatedBuffer);

          // Merge with background
          const finalImagePath = await mergeImages(
            generatedFilepath,
            timestamp.toString()
          );

          // Update job with final results
          if (job) {
            job.generatedUrl = `/generated/${generatedFilename}`;
            job.finalImageUrl = finalImagePath;
            job.status = 'completed';
          }

          return apiJson(request, {
            success: true,
            message: 'Image processed successfully',
            jobId,
          });
        } catch (error) {
          console.error('Error processing generated image:', error);
          if (job) {
            job.status = 'error';
            job.error = error instanceof Error ? error.message : 'Processing failed';
          }
          return apiJson(
            request,
            { error: 'Failed to process generated image' },
            { status: 500 }
          );
        }
      }
    }

    return apiJson(request, {
      success: true,
      message: 'Callback received',
      jobId,
    });
  } catch (error: any) {
    console.error('Error in callback:', error);
    return apiJson(
      request,
      { error: error?.message || 'Callback processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const blockedOriginResponse = rejectIfOriginNotAllowed(request);
  if (blockedOriginResponse) return blockedOriginResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawJobId = searchParams.get('jobId');

    const rateLimit = enforceRateLimit(request, {
      endpointKey: 'callbackGet',
      limits: RATE_LIMITS.callbackGet,
      userIdentifier: rawJobId,
    });
    if (rateLimit.limited) {
      return apiJson(
        request,
        {
          error: 'Too many status checks. Please wait and try again.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const jobIdResult = validateCallbackJobId(rawJobId);
    if ('error' in jobIdResult) {
      return apiJson(request, { error: jobIdResult.error }, { status: 400 });
    }
    const jobId = jobIdResult.data;

    console.log(`GET /api/callback called with jobId: ${jobId}`);
    console.log(`Current jobs in store:`, Array.from(jobStore.keys()));

    const job = jobStore.get(jobId);

    if (!job) {
      console.log(`Job ${jobId} not found in store`);
      return apiJson(
        request,
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return apiJson(request, {
      success: true,
      jobId,
      status: job.status,
      generatedUrl: job.generatedUrl || null,
      finalImageUrl: job.finalImageUrl || null,
      error: job.error || null,
    });
  } catch (error: any) {
    console.error('Error fetching job status:', error);
    return apiJson(
      request,
      { error: error?.message || 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
