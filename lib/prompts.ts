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
 Strictly preserve the original expression, including exact mouth shape, lip position, and smile intensity. Do not exaggerate or enhance the smile. Do not increase teeth visibility.
Age Adjustment:
 Subtly make the subject appear slightly younger (minor freshness only), without smoothing skin or removing natural details.
Hair:
 Preserve original hairstyle exactly (length, volume, texture, flow).
Makeup:
If present, preserve exactly as is
If minimal or none, keep natural (do not add heavy or artificial makeup)
Restrictions:
No tattoos
No ornaments or accessories (no jewelry, earrings, chains, etc.)
Clothing:
 Maintain same outfit with realistic fabric texture and natural folds. No added logos or patterns.

💡 Lighting (Fixed & Optimized)
Soft, warm editorial studio lighting with balanced exposure:
Gentle natural warm tone (subtle golden warmth, not orange)
Even illumination across the face
Soft shadows for depth (no harsh contrast)
Controlled highlights (no blown-out or overexposed areas)
No bright hotspots or facial glare
Natural skin tone preservation
Smooth light falloff for professional look

Skin & Realism:
 Maintain natural skin texture (pores, fine details). No smoothing or beauty filters.
Color Accuracy:
 True-to-life skin tones with slight warmth. No color cast or tint spill.
Image Quality:
 Ultra-sharp but natural detail. No over-sharpening, halos, blur, distortion, or asymmetry.
Background:
 Transparent PNG with clean alpha. No gradients, colors, or environment.

🚫 Negative Prompt (Female)
overexposed face, harsh lighting, blown highlights, bright hotspots, face glare, shiny skin, uneven lighting, high contrast lighting, hard shadows, neon lighting, colored lighting, magenta tint, purple tint, color cast, exaggerated smile, wide grin, teeth enhancement, artificial expression, heavy makeup, glam makeup, lipstick enhancement, skin smoothing, airbrushed skin, plastic skin, face distortion, asymmetry, blur, low detail, over-sharpening, halos, noise, artifacts, glitch, unrealistic rendering
`,
};
