-- Enable uuid-ossp extension for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ambition generations table
CREATE TABLE IF NOT EXISTS ambition_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  profession VARCHAR(255) NOT NULL,
  outfit VARCHAR(255) NOT NULL,
  gender VARCHAR(16) NOT NULL CHECK (gender IN ('male', 'female')),
  prompt TEXT NOT NULL,
  uploaded_image_url TEXT NOT NULL,
  generated_image_url TEXT NOT NULL,
  final_image_url TEXT NOT NULL,
  generation_status VARCHAR(32) NOT NULL DEFAULT 'completed',
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambition_generations_created_at
  ON ambition_generations (created_at DESC);