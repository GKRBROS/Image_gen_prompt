# Ambition API Documentation

## Endpoint

`POST https://memento.frameforge.one/api/ambition/generation`

## Purpose

Generate an A4 portrait result from a user-uploaded image using OpenRouter `bytedance-seed/seedream-4.5`, then store the stages in S3 prefixes `amb_upload`, `amb_generated`, and `amb_final`.

## Request

`multipart/form-data`

### Fields

- `photo` or `image`: uploaded source image
- `name`: person name
- `profession`: profession label used in the prompt
- `outfit`: outfit description used in the prompt
- `gender`: `male` or `female`

## Prompt Source

The prompt text is defined in [lib/amb_prompts.ts](lib/amb_prompts.ts) and switches between male and female prompt templates based on `gender`. The user does not send a freeform prompt string.

## Response

```json
{
  "success": true,
  "uploadedImage": "...",
  "generatedImage": "...",
  "finalImageUrl": "...",
  "prompt": "...",
  "gender": "male"
}
```

Additional notes:
- Maximum upload size: 2 MB per image (server-side validation).
- Returned image URLs are presigned S3 URLs (or public S3 URLs) and can be used directly by clients for preview/download.

## Supabase Table

The generation result is stored in `ambition_generations`.

See [sql/ambition_tables.sql](sql/ambition_tables.sql) for the schema.

## Notes

- This endpoint intentionally does not use the shared CORS helper.
- The route currently accepts requests without `OPTIONS` handling.
