export type GenderOption = 'neutral' | 'male' | 'female';

export const PROMPTS: Record<GenderOption, string> = {
  neutral: `Reimagine the uploaded person as a cinematic, high-end professional portrait with a refined corporate aesthetic and subtle heroic presence. Use the attached image as the sole identity reference. Preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle with high fidelity. Do not alter defining features. Ignore original pose.
Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K resolution. Pose: body facing forward, head naturally aligned, eyes looking directly at the camera (no flipping or mirroring). Posture upright, composed, confident, with relaxed shoulders.
Expression & Smile:
 Strictly preserve the original expression. Do not exaggerate or enhance the smile. Do not increase teeth visibility.
Age Adjustment:
 Subtle, realistic slight youthfulness (no artificial smoothing).
Hair:
 Preserve original hairstyle exactly.
Facial Hair:
If present, preserve exactly
If clean-shaven, do not add any
Makeup / Natural Look:
 Preserve as-is. Do not add artificial or heavy makeup.
Restrictions:
No tattoos
No ornaments or accessories
Clothing:
 Maintain same outfit with realistic fabric texture and natural folds.

💡 Lighting (Fixed & Optimized)
Soft, warm editorial studio lighting with balanced exposure:
Gentle natural warm tone
Even face lighting
Soft shadows (no harsh contrast)
No blown highlights or hotspots
No glare or shine
Natural skin tone preservation

Skin & Realism:
 Natural skin texture only. No smoothing or filters.
Color Accuracy:
 Neutral + slightly warm skin tones. No color spill.
Image Quality:
 Sharp, clean, realistic. No artifacts or distortion.
Background:
 Transparent PNG, clean alpha.

🚫 Negative Prompt (Neutral)
overexposed face, harsh lighting, blown highlights, hotspots, glare, shiny skin, uneven lighting, neon lighting, color cast, exaggerated smile, teeth enhancement, artificial expression, heavy makeup, skin smoothing, plastic skin, face distortion, asymmetry, blur, low detail, over-sharpening, halos, noise, artifacts, glitch, unrealistic rendering
`,

  male: `Reimagine the uploaded male person as a cinematic, high-end professional portrait with a refined corporate aesthetic and subtle heroic presence. Use the attached image as the sole identity reference. Preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle with high fidelity. Do not alter defining features. Ignore original pose.
Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K resolution. Pose: body facing forward, head naturally aligned, eyes looking directly at the camera (no flipping or mirroring). Posture upright, composed, confident, with relaxed shoulders.
Expression & Smile:
 Strictly preserve the original expression, including exact mouth shape, lip position, and smile intensity. Do not exaggerate or enhance the smile. Do not increase teeth visibility. Keep it natural, calm, and authentic.
Age Adjustment:
 Make the subject appear slightly younger in a subtle, realistic way (minor freshness only), without smoothing skin or removing natural details.
Facial Hair:
If facial hair exists, preserve it exactly as is
If clean-shaven, keep it clean—do not add any beard, mustache, or stubble
Hair:
 Preserve original hairstyle exactly, including length, density, and texture.
Restrictions:
No tattoos
No ornaments or accessories (no jewelry, chains, earrings, etc.)
Clothing:
 Maintain the same outfit with realistic fabric texture and natural folds. No added logos or patterns.

💡 Lighting (Fixed & Optimized)
Use soft, warm editorial studio lighting with balanced exposure.
Gentle natural warm tone (subtle golden warmth, not orange)
Even illumination across the face
Soft shadows for depth (no harsh contrast)
Controlled highlights (no blown-out or overexposed areas)
No strong key light hotspots
No glare on forehead, nose, or cheeks
Natural skin tone preservation
Smooth light falloff for a professional studio look

Skin & Realism:
 Maintain natural skin texture with visible pores and fine details. Avoid smoothing, plastic skin, or beauty filters.
Color Accuracy:
 Ensure true-to-life skin tones with slight warm balance. No color cast or tint spill.
Image Quality:
 Ultra-sharp but natural detail. No over-sharpening, halos, blur, distortion, or asymmetry.
Background:
 Completely removed. Transparent PNG with clean alpha edges. No gradients, colors, or environment.

🚫 Negative Prompt
overexposed face, harsh lighting, strong highlights, blown highlights, bright hotspots, face glare, shiny skin, uneven lighting, high contrast lighting, hard shadows, dramatic lighting, neon lighting, colored lighting, magenta tint, purple tint, color cast, background light spill, exaggerated smile, wide grin, teeth enhancement, artificial expression, forced smile, skin smoothing, airbrushed skin, plastic skin, face distortion, asymmetry, warped features, blur, low resolution, low detail, over-sharpening, halos, noise, artifacts, glitch, unrealistic rendering
`,

  female: `Reimagine the uploaded female person as a cinematic, high-end professional portrait with a refined corporate aesthetic and subtle heroic presence. Use the attached image as the sole identity reference. Preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle with high fidelity. Do not alter defining features. Ignore original pose.

Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K resolution. Pose: body facing forward, head naturally aligned, eyes looking directly at the camera (no flipping or mirroring). Posture upright, composed, confident, with relaxed shoulders.

Expression & Smile:
Strictly preserve the original expression, including exact mouth shape, lip position, and smile intensity. Do not exaggerate or enhance the smile. Do not increase teeth visibility. Keep it natural, calm, and authentic.

Age Adjustment:
Make the subject appear slightly younger in a subtle, realistic way (minor freshness and reduced fatigue only), SLIGHT smoothing skin

Hair:
Preserve original hairstyle exactly, including length, volume, texture, and natural flow. Do not restyle or artificially enhance.

Makeup:
If makeup is present, preserve it exactly as is. If minimal or none, keep it natural—do not add heavy or artificial makeup.

Facial Features:
Do not alter lip size, eye shape, nose structure, or facial contours. Maintain natural proportions and identity.

Restrictions:

No tattoos
No ornaments or accessories (no jewelry, earrings, chains, etc.)

Clothing:
Maintain the same outfit with realistic fabric texture, natural folds, and accurate material rendering. No added logos or patterns.

Lighting:
Professional editorial studio lighting. Soft, neutral,DIFFUSED, and well-balanced with natural highlights and gentle shadow depth. No dramatic contrast, no colored lighting, no neon tones, no stylization.
 
Skin & Realism:
Maintain natural skin texture. Avoid airbrushing, plastic smoothing, or beauty filters.

Color Accuracy:
Preserve true-to-life skin tones. Prevent any color cast or background light spill on the face.

Image Quality:
Ultra-sharp facial detail, crisp natural eyes, consistent sharpness across the face. Avoid over-sharpening, halos, blur, distortion, or asymmetry. Ensure full photorealistic coherence.

Background:
Completely removed. Output as a transparent PNG with clean alpha edges. No gradients, colors, environment, text, or watermark.

🚫 Negative Prompt

exaggerated smile, wide grin, teeth enhancement, artificial expression, forced smile, over-friendly expression, skin smoothing, airbrushed skin, beauty filter, plastic skin, waxy texture, face distortion, asymmetry, warped features, deformed face, bad anatomy, blur, low resolution, low detail, over-sharpening, halos, noise, artifacts, glitch, duplicate features, extra eyes, extra lips, misaligned eyes, unnatural eyes, heavy makeup, over makeup, glam makeup, lipstick enhancement, neon lighting, colored lighting, magenta tint, purple tint, color cast, background light spill, stylized lighting, cartoonish, painterly, unrealistic rendering, oversaturated colors`,
};
