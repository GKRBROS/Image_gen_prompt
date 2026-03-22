export type GenderOption = 'neutral' | 'male' | 'female';

export const PROMPTS: Record<GenderOption, string> = {
  neutral: `Reimagine the uploaded person as a cinematic, high-end professional portrait with a heroic yet grounded presence, inspired by modern DC-style realism translated into a refined corporate aesthetic. Use the attached image, preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle without any modification or beautification. Ignore original pose.

Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K. Apply a pose: body facing the camera, face looking toward the camera side of the frame with gaze very slightly to the left, do not flip or mirror. Posture is upright, composed, and confident with relaxed but firm shoulders, expressing leadership and calm authority. Expression is hopeful and assured with a subtle controlled smile.

Identity preservation is absolute, including glasses only if present (same style), tattoos, piercings, jewelry, scars, moles, freckles, birthmarks, natural facial hair if present, age, ethnicity, and body proportions. Hair must retain exact length, density, and texture. Any culturally or religious attire must retain meaning and coverage.

The person wears the same clothing as in the original image, with realistic fabric texture and natural folds, no logos or patterns.

Lighting is dramatic high-contrast with a strong left key light and soft rim light, creating depth and warm highlights. Captured with an 85mm portrait look, shallow depth of field, ultra-sharp facial detail, sharp eyes, and natural skin rendering.

Background completely removed, transparent PNG with clean alpha. No gradient, no color, no environment, no backdrop. No text, watermark, or additional elements.`,

  male: `Reimagine the uploaded male person as a cinematic, high-end professional portrait with a heroic yet grounded presence, inspired by modern DC-style realism translated into a refined corporate aesthetic. Use the attached image, preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle without any modification or beautification. Ignore original pose.

Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K. Apply a pose: body facing the camera, face looking toward the camera side of the frame with gaze very slightly to the left, do not flip or mirror. Posture is upright, composed, and confident with relaxed but firm shoulders, expressing leadership and calm authority. Expression is hopeful and assured with a subtle controlled smile.

Identity preservation is absolute, including glasses only if present (same style), tattoos, piercings, jewelry, scars, moles, freckles, birthmarks, natural facial hair if present (mustache, beard, stubble, etc.), age, ethnicity, and body proportions. Hair must retain exact length, density, and texture. Any culturally or religious attire must retain meaning and coverage.

He wears the same clothing as he is currently wearing with realistic fabric texture and natural folds, no logos or patterns.

Lighting is dramatic high-contrast with a strong left key light and soft rim light, creating depth and warm highlights. Captured with an 85mm portrait look, shallow depth of field, ultra-sharp facial detail, sharp eyes, and natural skin rendering.

Background completely removed, transparent PNG with clean alpha. No gradient, no color, no environment, no backdrop. No text, watermark, or additional elements.`,

  female: `Reimagine the uploaded female person as a cinematic, high-end professional portrait with a heroic yet grounded presence, inspired by modern DC-style realism translated into a refined corporate aesthetic. Use the attached image, preserve exact facial identity, bone structure, proportions, skin tone, natural texture, and hairstyle without any modification or beautification. Ignore original pose.

Render as an upper-body shot in a 2:3 vertical aspect ratio, true 4K. Apply a pose: body facing the camera, face looking toward the camera side of the frame with gaze very slightly to the left, do not flip or mirror. Posture is upright, composed, and confident with relaxed but firm shoulders, expressing leadership and calm authority. Expression is hopeful and assured with a subtle controlled smile.

Identity preservation is absolute, including glasses only if present (same style), tattoos, piercings, jewelry, scars, moles, freckles, birthmarks, natural facial hair if present, age, ethnicity, and body proportions. Hair must retain exact length, density, and texture. Any culturally or religious attire must retain meaning and coverage.

She wears the same clothing as she is currently wearing with realistic fabric texture and natural folds, no logos or patterns.

Lighting is dramatic high-contrast with a strong left key light and soft rim light, creating depth and warm highlights. Captured with an 85mm portrait look, shallow depth of field, ultra-sharp facial detail, sharp eyes, and natural skin rendering.

Background completely removed, transparent PNG with clean alpha. No gradient, no color, no environment, no backdrop. No text, watermark, or additional elements.`,
};
