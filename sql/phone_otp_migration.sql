-- Migration: Transition from Email to Phone-based OTP (Amazon SNS)
-- For Project: AI IMAGE GEN / Frame Forge

BEGIN;

-- 1. Update image_generation_requests table
ALTER TABLE public.image_generation_requests 
RENAME COLUMN email TO phone;

-- Ensure phone type is TEXT/VARCHAR to accommodate + and digits
ALTER TABLE public.image_generation_requests 
ALTER COLUMN phone TYPE TEXT;

-- Rename indices/constraints if they exist (Supabase specific naming convention)
ALTER TABLE public.image_generation_requests 
RENAME CONSTRAINT image_generation_requests_email_key TO image_generation_requests_phone_key;


-- 2. Update admin_users table
ALTER TABLE public.admin_users 
RENAME COLUMN email TO phone;

ALTER TABLE public.admin_users 
ALTER COLUMN phone TYPE TEXT;

ALTER TABLE public.admin_users 
RENAME CONSTRAINT admin_users_email_key TO admin_users_phone_key;


-- 3. Update admin_otps table
ALTER TABLE public.admin_otps 
RENAME COLUMN email TO phone;

ALTER TABLE public.admin_otps 
ALTER COLUMN phone TYPE TEXT;

-- Update Foreign Key to point to the new phone column in admin_users
-- (PostgreSQL column renames usually update the FK target automatically, but we check constraints)
-- If the constraint name was admin_otps_email_fkey, you might want to rename it for clarity:
-- ALTER TABLE public.admin_otps RENAME CONSTRAINT admin_otps_email_fkey TO admin_otps_phone_fkey;


-- 4. Clean up any existing OTPs to avoid type/logic conflicts during the switch
UPDATE public.image_generation_requests SET otp_code_hash = NULL, otp_expires_at = NULL, is_verified = FALSE;
UPDATE public.admin_otps SET otp_code_hash = NULL, otp_expires_at = NULL, is_verified = FALSE;

COMMIT;

-- Note: Ensure your .env.local is updated with AWS_SNS_REGION=ap-south-1
-- and OTP_SECRET for the new secure hashing logic to work.
