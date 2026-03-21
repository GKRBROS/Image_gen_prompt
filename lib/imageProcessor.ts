import sharp from 'sharp';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { getSupabaseClient } from '@/lib/supabase';
import { createCanvas, registerFont } from 'canvas';

let fontsRegistered = false;

const A4_WIDTH_PX = 2480;
const A4_HEIGHT_PX = 3508;

const registerCanvasFonts = () => {
  if (fontsRegistered) return;

  const calSansPath = join(process.cwd(), 'public', 'CalSans-SemiBold.ttf');
  if (existsSync(calSansPath)) {
    registerFont(calSansPath, { family: 'Cal Sans', weight: '600', style: 'normal' });
  } else {
    console.warn('Cal Sans font file not found:', calSansPath);
  }

  const geistPath = join(process.cwd(), 'public', 'Geist-Regular.ttf');
  if (existsSync(geistPath)) {
    registerFont(geistPath, { family: 'Geist', weight: '400', style: 'normal' });
  } else {
    console.warn('Geist font file not found:', geistPath);
  }

  fontsRegistered = true;
};

export async function mergeImages(
  generatedImagePath: string,
  timestamp: string,
  name?: string
): Promise<string> {
  try {
    console.log('--- MERGE IMAGES DEBUG START ---');
    console.log('generatedImagePath:', generatedImagePath);
    console.log('Text Overlay:', { name });
    console.log('Node Env:', process.env.NODE_ENV);

    // Create output directory
    const isProduction = process.env.NODE_ENV === 'production';
    const publicOutputDir = join(process.cwd(), 'public', 'final');
    const tmpOutputDir = join('/tmp', 'final');
    const outputDir = isProduction ? tmpOutputDir : publicOutputDir;

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist or be read-only
    }

    // Load background image
    const backgroundPath = join(process.cwd(), 'public', 'background.png');
    const layerPath = join(process.cwd(), 'public', 'layer.png');
    console.log('Paths:', { backgroundPath, layerPath });

    // Load images and metadata
    const [bgMetadata, layerMetadata] = await Promise.all([
      sharp(backgroundPath).metadata(),
      sharp(layerPath).metadata(),
    ]);

    const bgWidth = bgMetadata.width || 1024;
    const bgHeight = bgMetadata.height || 1024;
    const layerWidth = layerMetadata.width || 1080;
    const layerHeight = layerMetadata.height || 1920;

    console.log(`Dimensions - BG: ${bgWidth}x${bgHeight}, Layer: ${layerWidth}x${layerHeight}`);

    // STEP 1: Composite generated image BEHIND layer.png
    // Fill the layer strongly (like reference final.jpeg) so the subject
    // occupies the full hero area with confident framing.
    const charWidth = layerWidth;
    const charHeight = Math.floor(layerHeight * 0.66);
    const charTopOffset = Math.floor(layerHeight * 0.14);
    const charLeftOffset = 0;

    const layerWithCharacter = await sharp(layerPath)
      .resize(layerWidth, layerHeight)
      .composite([
        {
          input: await sharp(generatedImagePath)
            .resize(charWidth, charHeight, {
              fit: 'cover',
              position: 'top'
            })
            .toBuffer(),
          blend: 'dest-over',
          top: charTopOffset,
          left: charLeftOffset
        }
      ])
      .toBuffer();

    // STEP 2: Create Text Overlay (name only)
    let finalCompositeLayers: any[] = [
      {
        input: await sharp(layerWithCharacter)
          .resize(A4_WIDTH_PX, A4_HEIGHT_PX, {
            fit: 'cover'
          })
          .toBuffer(),
        gravity: 'center',
        blend: 'over'
      }
    ];

    if (name) {
      // Create text overlay using Canvas (better than SVG for text rendering)
      const canvasWidth = A4_WIDTH_PX;
      const canvasHeight = A4_HEIGHT_PX;

      const nameText = name ? name.toUpperCase() : '';

      // Auto-scaling logic (large and bold look, fitted to footer width)
      const maxWidth = Math.floor(canvasWidth * 0.95);
      const maxNameSize = Math.floor(canvasWidth * 0.12);
      const minNameSize = Math.floor(canvasWidth * 0.045);
      const estimatedWidthPerChar = 0.52;
      const desiredFillRatio = 0.96;
      let nameFontSize = Math.floor(maxWidth / (Math.max(nameText.length, 1) * estimatedWidthPerChar));
      nameFontSize = Math.max(minNameSize, Math.min(maxNameSize, nameFontSize));

      const nameY = Math.floor(canvasHeight * 0.845);

      console.log('Text overlay:', { nameText, nameFontSize, nameY, maxWidth });

      // Create canvas with text using node-canvas
      try {
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

        // Draw name text (Cal Sans, larger and bolder)
        if (nameText) {
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
          nameFontSize = fontSize;
          drawTextWithKerning(
            nameText,
            Math.floor(canvasWidth / 2),
            nameY,
            `700 ${fontSize}px "Cal Sans", Arial, sans-serif`,
            '#FFFFFF',
            letterSpacingPx,
            strokeWidthPx
          );
        }

        const textBuffer = canvas.toBuffer('image/png');
        console.log('Canvas text overlay created, buffer size:', textBuffer.length);

        finalCompositeLayers.push({
          input: textBuffer,
          top: 0,
          left: 0,
          blend: 'over'
        });
      } catch (canvasErr) {
        console.warn('Canvas text rendering failed, falling back to SVG:', canvasErr);
        // Fallback to SVG if canvas fails
        const svgWidth = A4_WIDTH_PX;
        const svgHeight = A4_HEIGHT_PX;
        let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg"><defs><style>text { font-family: Arial, sans-serif; }</style></defs>`;
        
        if (nameText) {
          const fontSize = Math.max(nameFontSize, 24);
          const strokeWidth = Math.max(2, Math.floor(fontSize * 0.035));
          svgContent += `<text x="${Math.floor(svgWidth / 2)}" y="${nameY}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="${strokeWidth}" font-size="${fontSize}" font-weight="700" font-family="Cal Sans, Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">${nameText}</text>`;
        }
        
        svgContent += `</svg>`;
        
        finalCompositeLayers.push({
          input: Buffer.from(svgContent),
          top: 0,
          left: 0,
          blend: 'over'
        });
      }
    }

    const finalBuffer = await sharp(backgroundPath)
      .resize(A4_WIDTH_PX, A4_HEIGHT_PX, {
        fit: 'cover',
        position: 'center'
      })
      .composite(finalCompositeLayers)
      .png()
      .toBuffer();

    // Generate filename
    const timestamp_str = timestamp.toString();
    const outputFilename = `final-${timestamp_str}.png`;

    // Save final image locally only in development
    if (!isProduction) {
      try {
        const outputPath = join(outputDir, outputFilename);
        await writeFile(outputPath, finalBuffer);
        console.log('Final image saved locally:', outputPath);
      } catch (err) {
        console.warn('Could not save final image locally:', err);
      }
    }

    // Upload final image to Supabase in production so it can be previewed and downloaded
    if (isProduction) {
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(`final/${outputFilename}`, finalBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase final upload error:', uploadError);
        throw new Error('Failed to upload final image');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('generated-images')
        .getPublicUrl(`final/${outputFilename}`);

      console.log('Final image uploaded:', publicUrl);
      console.log('--- MERGE IMAGES DEBUG END - SUCCESS ---');
      return publicUrl;
    }

    console.log('--- MERGE IMAGES DEBUG END - SUCCESS ---');
    return `/final/${outputFilename}`;
  } catch (error) {
    console.error('CRITICAL ERROR in mergeImages:', error);
    throw new Error(`Failed to merge images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
