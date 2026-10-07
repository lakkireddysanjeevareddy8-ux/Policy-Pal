-- Migration: 003_add_assumptions_to_confirm.sql
-- Adds assumptions_to_confirm column to scheme_matches and ai_source to assessments

ALTER TABLE scheme_matches
  ADD COLUMN IF NOT EXISTS assumptions_to_confirm JSONB DEFAULT '[]'::jsonb;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'gemini';
