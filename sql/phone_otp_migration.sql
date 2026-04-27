-- Migration: Change email-based OTP to phone-based OTP
-- This script replaces 'email' columns with 'phone' across relevant tables.

-- 1. Update image_generation_requests table
ALTER TABLE image_generation_requests 
RENAME COLUMN email TO phone;

-- Update constraints if any (assuming unique constraint on email)
-- If there was a unique constraint named something like 'image_generation_requests_email_key'
-- it might need to be renamed or recreated. Supabase usually handles column renames
-- but explicit SQL for the unique index is safer:
-- DROP INDEX IF EXISTS image_generation_requests_email_key;
-- CREATE UNIQUE INDEX IF NOT EXISTS image_generation_requests_phone_key ON image_generation_requests(phone);

-- 2. Update admin_users table
ALTER TABLE admin_users 
RENAME COLUMN email TO phone;

-- 3. Update admin_otps table
ALTER TABLE admin_otps 
RENAME COLUMN email TO phone;

-- Note: Ensure that the 'phone' column in all tables is VARCHAR or TEXT 
-- to accommodate E.164 formatting (e.g., +1234567890).
