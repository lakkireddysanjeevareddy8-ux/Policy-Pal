-- 004_widen_languages_and_catalog_translations.sql
-- Widen preferred_language and assessment language constraints to all 13 supported Indian languages:
-- en (English), hi (Hindi), te (Telugu), ta (Tamil), kn (Kannada), ml (Malayalam), mr (Marathi),
-- gu (Gujarati), bn (Bengali), pa (Punjabi), or (Odia), as (Assamese), ur (Urdu)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_language_check;
ALTER TABLE users ADD CONSTRAINT users_preferred_language_check 
  CHECK (preferred_language IN ('en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'));

ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_language_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_language_check 
  CHECK (language IN ('en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'));

-- Catalog translation: add translations jsonb column to schemes and document_types
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE document_types ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
