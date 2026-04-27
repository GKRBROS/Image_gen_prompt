-- Migration: Change email-based OTP to phone-based OTP
-- This script replaces 'email' columns with 'phone' across relevant tables and handles constraints.

BEGIN;

-- 1. Update image_generation_requests table
ALTER TABLE public.image_generation_requests 
RENAME COLUMN email TO phone;

-- Ensure phone is TEXT (CITEXT to TEXT is fine, but E.164 doesn't need case-insensitivity anyway)
ALTER TABLE public.image_generation_requests 
ALTER COLUMN phone TYPE TEXT;

-- Rename indices and constraints if they exist
ALTER TABLE public.image_generation_requests 
RENAME CONSTRAINT image_generation_requests_email_key TO image_generation_requests_phone_key;

-- 2. Update admin_users table
ALTER TABLE public.admin_users 
RENAME COLUMN email TO phone;

ALTER TABLE public.admin_users 
ALTER COLUMN phone TYPE VARCHAR(255);

-- 3. Update admin_otps table
-- Note: This has a foreign key to admin_users(phone) now.
-- Rename the column first
ALTER TABLE public.admin_otps 
RENAME COLUMN email TO phone;

ALTER TABLE public.admin_otps 
ALTER COLUMN phone TYPE VARCHAR(255);

-- Update foreign key constraint name if desired (PostgreSQL usually keeps the logic but name might be confusing)
-- ALTER TABLE public.admin_otps RENAME CONSTRAINT admin_otps_email_fkey TO admin_otps_phone_fkey;

-- 4. Update elavarkum_requests table (if it exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'elavarkum_requests') THEN
        ALTER TABLE public.elavarkum_requests RENAME COLUMN email TO phone;
        ALTER TABLE public.elavarkum_requests ALTER COLUMN phone TYPE TEXT;
    END IF;
END $$;

COMMIT;

-- Note: Ensure that the 'phone' column in all tables is VARCHAR or TEXT 
-- to accommodate E.164 formatting (e.g., +919876543210).
