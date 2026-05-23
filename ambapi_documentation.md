# Ambition API Documentation

## Endpoint

`POST /api/ambition/generation`

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

## Supabase Table

The generation result is stored in `ambition_generations`.

See [sql/ambition_tables.sql](sql/ambition_tables.sql) for the schema.

## Notes

- This endpoint intentionally does not use the shared CORS helper.
- The route currently accepts requests without `OPTIONS` handling.
