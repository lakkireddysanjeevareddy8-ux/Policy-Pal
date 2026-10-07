-- PolicyPal Initial Schema Migration
-- Note: gen_random_uuid() is built-in in PostgreSQL 13+ and Supabase

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'te', 'hi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER,
  gender TEXT,
  state TEXT,
  district TEXT,
  occupation TEXT,
  annual_income NUMERIC,
  social_category TEXT,
  land_holding_acres NUMERIC,
  education_level TEXT,
  is_student BOOLEAN DEFAULT FALSE,
  is_farmer BOOLEAN DEFAULT FALSE,
  is_business_owner BOOLEAN DEFAULT FALSE,
  family_size INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Document Types Table (Catalog)
CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  label_te TEXT,
  label_hi TEXT,
  where_to_get TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Schemes Table (Catalog)
CREATE TABLE IF NOT EXISTS schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_te TEXT,
  name_hi TEXT,
  ministry TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('central', 'state')),
  state TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'agriculture', 'health', 'education', 'housing', 'finance', 'employment', 'social_security', 'women_child'
  )),
  benefit_summary TEXT NOT NULL,
  eligibility_summary TEXT NOT NULL,
  required_doc_keys TEXT[] NOT NULL DEFAULT '{}',
  application_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  official_url TEXT NOT NULL,
  last_verified DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. User Documents Table (Cross-scheme readiness tracker)
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_key TEXT NOT NULL REFERENCES document_types(key) ON UPDATE CASCADE ON DELETE CASCADE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_document UNIQUE(user_id, doc_key)
);

-- 6. Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  situation_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'te', 'hi')),
  extracted_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Scheme Matches Table
CREATE TABLE IF NOT EXISTS scheme_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  eligibility_reason TEXT NOT NULL,
  missing_info JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applying', 'applied', 'rejected', 'archived')),
  ai_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_assessment_scheme UNIQUE(assessment_id, scheme_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_level ON schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_slug ON schemes(slug);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_doc_key ON user_documents(doc_key);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheme_matches_assessment_id ON scheme_matches(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scheme_matches_user_id ON scheme_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_scheme_matches_scheme_id ON scheme_matches(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_matches_status ON scheme_matches(status);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_matches ENABLE ROW LEVEL SECURITY;
