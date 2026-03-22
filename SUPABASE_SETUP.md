# 🚀 Supabase Migration Guide

## ✅ What's Been Done

1. ✅ Removed Vercel Blob dependency
2. ✅ Installed Supabase client (`@supabase/supabase-js`)
3. ✅ Created SQL setup script (`supabase-setup.sql`)
4. ✅ Updated code to use Supabase Storage
5. ✅ Added database table for storing generation metadata

## 📋 Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details
4. Wait for project to be ready (~2 minutes)

### 2. Run SQL Setup

1. In Supabase Dashboard, go to **SQL Editor**
2. Open `supabase-setup.sql` from your project
3. Copy and paste the entire SQL script
4. Click **Run** to execute

**OR** manually create:

- **Storage Bucket**: Go to **Storage** → Create bucket named `generated-images` (make it PUBLIC)
- **Database Table**: Run the SQL from `supabase-setup.sql` in SQL Editor

### 3. Get API Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")

### 4. Update Environment Variables

Add to your `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# OpenRouter (keep this)
OPENROUTER_API_KEY=your_openrouter_key

# Remove this line (no longer needed)
# BLOB_READ_WRITE_TOKEN=...
```

### 5. Test Locally

```bash
npm run dev
```

Generate an image and check:

- ✅ Image appears in Supabase Storage (`generated-images` bucket)
- ✅ Metadata saved in `a4_generations` table

### 6. Deploy to Railway/Render

1. Add the same environment variables to your hosting platform
2. Push your code:
   ```bash
   git add .
   git commit -m "Migrate to Supabase Storage"
   git push
   ```

## 🎯 What Changed

### Files Modified:

- `app/api/generate/route.ts` - Uses Supabase Storage + Database
- `lib/imageProcessor.ts` - Removed Vercel Blob
- `lib/supabase.ts` - **NEW** Supabase client

### Files Created:

- `supabase-setup.sql` - Database schema
- `.env.example` - Environment template

### Packages:

- ➕ Added: `@supabase/supabase-js`
- ➖ Removed: `@vercel/blob`

## 📊 Database Schema

**Table: `a4_generations`**

- `id` (UUID) - Auto-generated
- `name` (TEXT) - Person's name
- `designation` (TEXT) - Person's designation
- `image_url` (TEXT) - Final image URL
- `output_format` (TEXT) - Output type (`A4`)
- `output_width` (INTEGER) - Output width (`2480`)
- `output_height` (INTEGER) - Output height (`3508`)
- `created_at` (TIMESTAMP) - Auto-generated

## 🔍 Troubleshooting

**Images not uploading?**

- Check bucket name is exactly `generated-images`
- Ensure bucket is set to PUBLIC
- Verify environment variables are correct

**Database insert failing?**

- Run the SQL setup script again
- Check RLS policies are enabled
- Verify table name is `a4_generations`

---

**Need help?** Check Supabase docs: https://supabase.com/docs
