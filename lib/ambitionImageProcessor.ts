import sharp from 'sharp';
import { existsSync } from 'fs';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { createCanvas, registerFont } from 'canvas';
import type { OverlayOptions } from 'sharp';

import { isS3Configured, uploadBufferToS3 } from '@/lib/s3Storage';
import { getSupabaseClient } from '@/lib/supabase';

let fontsRegistered = false;

const A4_WIDTH_PX = 2480;
const A4_HEIGHT_PX = 3508;
const NAME_TEXT_Y_OFFSET_PX = 90;

const registerCanvasFonts = () => {
  if (fontsRegistered) return;

  const calSansPath = join(process.cwd(), 'public', 'CalSans-SemiBold.ttf');
  if (existsSync(calSansPath)) {
    registerFont(calSansPath, { family: 'Cal Sans', weight: '600', style: 'normal' });
  }

  const geistPath = join(process.cwd(), 'public', 'Geist-Regular.ttf');
  if (existsSync(geistPath)) {
    registerFont(geistPath, { family: 'Geist', weight: '400', style: 'normal' });
  }

  fontsRegistered = true;
};

const resolveLayerPath = () => {
  const layerCandidates = [
    join(process.cwd(), 'public', 'layer_A4.png'),
    join(process.cwd(), 'public', 'layer - A4.png'),
    join(process.cwd(), 'public', 'layer.png'),
  ];

  for (const layerPath of layerCandidates) {
    if (existsSync(layerPath)) {
      return layerPath;
    }
  }

  return layerCandidates[0];
};

const createTextOverlay = async (name: string) => {
  const canvasWidth = A4_WIDTH_PX;
  const canvasHeight = A4_HEIGHT_PX;
  const nameText = name.toUpperCase();

  const maxWidth = Math.floor(canvasWidth * 0.95);
  const maxNameSize = Math.floor(canvasWidth * 0.1);
  const minNameSize = Math.floor(canvasWidth * 0.045);
  const estimatedWidthPerChar = 0.52;
  const desiredFillRatio = 0.96;

  let nameFontSize = Math.floor(maxWidth / (Math.max(nameText.length, 1) * estimatedWidthPerChar));
  nameFontSize = Math.max(minNameSize, Math.min(maxNameSize, nameFontSize));

  const nameY = Math.floor(canvasHeight * 0.79) + NAME_TEXT_Y_OFFSET_PX;

  registerCanvasFonts();

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const drawTextWithKerning = (
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    letterSpacingPx = 0,
    strokeWidthPx = 0
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;

    if (strokeWidthPx > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidthPx;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (!letterSpacingPx) {
      const textWidth = ctx.measureText(text).width;
      if (strokeWidthPx > 0) {
        ctx.strokeText(text, x - textWidth / 2, y);
      }
      ctx.fillText(text, x - textWidth / 2, y);
      return;
    }

    let totalWidth = 0;
    for (const char of text) {
      totalWidth += ctx.measureText(char).width + letterSpacingPx;
    }
    totalWidth -= letterSpacingPx;

    let currentX = x - totalWidth / 2;
    for (const char of text) {
      if (strokeWidthPx > 0) {
        ctx.strokeText(char, currentX, y);
      }
      ctx.fillText(char, currentX, y);
      currentX += ctx.measureText(char).width + letterSpacingPx;
    }
  };

  let fittedNameSize = Math.max(nameFontSize, minNameSize);
  ctx.font = `700 ${fittedNameSize}px "Cal Sans", Arial, sans-serif`;

  while (fittedNameSize > minNameSize && ctx.measureText(nameText).width > maxWidth) {
    fittedNameSize -= 2;
    ctx.font = `700 ${fittedNameSize}px "Cal Sans", Arial, sans-serif`;
  }

  while (fittedNameSize < maxNameSize && ctx.measureText(nameText).width < maxWidth * desiredFillRatio) {
    fittedNameSize += 2;
    ctx.font = `700 ${fittedNameSize}px "Cal Sans", Arial, sans-serif`;
  }

  const fontSize = Math.max(fittedNameSize, 24);
  const measuredNameWidth = ctx.measureText(nameText).width;
  const gaps = Math.max(nameText.length - 1, 1);
  let letterSpacingPx = 0;

  if (nameText.length > 1 && measuredNameWidth < maxWidth * 0.99) {
    letterSpacingPx = (maxWidth - measuredNameWidth) / gaps;
    letterSpacingPx = Math.max(0, Math.min(letterSpacingPx, Math.floor(fontSize * 0.06)));
  }

  const strokeWidthPx = Math.max(2, Math.floor(fontSize * 0.035));
  drawTextWithKerning(
    nameText,
    Math.floor(canvasWidth / 2),
    nameY,
    `700 ${fontSize}px "Cal Sans", Arial, sans-serif`,
    '#FFFFFF',
    letterSpacingPx,
    strokeWidthPx
  );

  return canvas.toBuffer('image/png');
};

const uploadFinalBuffer = async (buffer: Buffer, filename: string, s3Folder = 'amb_final') => {
  const isProduction = process.env.NODE_ENV === 'production';
  const outputDir = isProduction ? join('/tmp', 'final') : join(process.cwd(), 'public', 'final');
  await mkdir(outputDir, { recursive: true }).catch(() => undefined);

  if (!isProduction) {
    await writeFile(join(outputDir, filename), buffer).catch(() => undefined);
  }

  if (isS3Configured()) {
    try {
      return await uploadBufferToS3({
        key: `${s3Folder}/${filename}`,
        body: buffer,
        contentType: 'image/png',
      });
    } catch (error) {
      console.warn('S3 final upload failed, falling back to Supabase/local storage:', error);
    }
  }

  if (isProduction) {
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(`${s3Folder}/${filename}`, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Failed to upload final image');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(`${s3Folder}/${filename}`);

    return publicUrl;
  }

  return `/final/${filename}`;
};

export async function mergeAmbitionImages(
  generatedImagePath: string,
  timestamp: string,
  name?: string,
  options?: { s3Folder?: string }
): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';
  const outputFilename = `ambition-final-${timestamp}.png`;
  const s3Folder = options?.s3Folder || 'amb_final';
  const layerPath = resolveLayerPath();

  const layerBuffer = await sharp(layerPath)
    .resize(A4_WIDTH_PX, A4_HEIGHT_PX, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: await sharp(generatedImagePath)
          .resize(A4_WIDTH_PX, A4_HEIGHT_PX, { fit: 'cover', position: 'center' })
          .toBuffer(),
        blend: 'dest-over' as const,
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();

  const finalCompositeLayers: OverlayOptions[] = [
    {
      input: layerBuffer,
      top: 0,
      left: 0,
      blend: 'over' as const,
    },
  ];

  if (name) {
    finalCompositeLayers.push({
      input: await createTextOverlay(name),
      top: 0,
      left: 0,
      blend: 'over' as const,
    });
  }

  const finalBuffer = await sharp({
    create: {
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(finalCompositeLayers)
    .png()
    .toBuffer();

  const tempOutputDir = join('/tmp', 'final');
  await mkdir(tempOutputDir, { recursive: true }).catch(() => undefined);
  const tempOutputPath = join(tempOutputDir, outputFilename);
  await writeFile(tempOutputPath, finalBuffer).catch(() => undefined);

  if (!isProduction) {
    const publicOutputDir = join(process.cwd(), 'public', 'final');
    await mkdir(publicOutputDir, { recursive: true }).catch(() => undefined);
    await writeFile(join(publicOutputDir, outputFilename), finalBuffer).catch(() => undefined);
  }

  return uploadFinalBuffer(finalBuffer, outputFilename, s3Folder);
}