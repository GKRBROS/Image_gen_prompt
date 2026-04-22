# Email OTP Image Generator

Register an email, verify a 6-digit OTP, then submit a name, organization, gender, and photo to generate a poster-style image through the backend.

## Features

- Email registration with duplicate checking in Supabase
- 6-digit OTP generation and verification
- Profile capture for name, organization, and gender
- Photo upload plus AI image generation
- Final poster composition with name and organization text
- Result URLs stored back in Supabase

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OTP_SECRET=your_random_secret
OPENROUTER_API_KEY=your_openrouter_key
GENERATION_PROMPT=optional_custom_prompt_template
```

3. Run the Supabase SQL script:

- Open `supabase-setup.sql` in the Supabase SQL editor
- Run it to create the request table and bucket

## Running the App

Development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## API Flow

1. `POST /api/auth/request-otp` creates the email row and generates the OTP
2. `POST /api/auth/verify-otp` validates the 6-digit code
3. `POST /api/generate` uploads the photo, generates the image, merges the poster, and saves the final URLs

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Supabase for persistence and storage
- OpenRouter image generation
- Sharp for image processing

## Notes

- The backend expects `SUPABASE_SERVICE_ROLE_KEY` for server-side database access.
- `supabase-setup.sql` creates the storage bucket `generated-images` and the `image_generation_requests` table.
- In development, the request OTP route returns the OTP in the response so you can test the flow without an email service.
