-- Migration 002: Add updated_at auto-update trigger function and attach to every table

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 2. profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 3. schemes
DROP TRIGGER IF EXISTS trg_schemes_updated_at ON schemes;
CREATE TRIGGER trg_schemes_updated_at
BEFORE UPDATE ON schemes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 4. document_types
DROP TRIGGER IF EXISTS trg_document_types_updated_at ON document_types;
CREATE TRIGGER trg_document_types_updated_at
BEFORE UPDATE ON document_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 5. user_documents
DROP TRIGGER IF EXISTS trg_user_documents_updated_at ON user_documents;
CREATE TRIGGER trg_user_documents_updated_at
BEFORE UPDATE ON user_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 6. assessments
DROP TRIGGER IF EXISTS trg_assessments_updated_at ON assessments;
CREATE TRIGGER trg_assessments_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 7. scheme_matches
DROP TRIGGER IF EXISTS trg_scheme_matches_updated_at ON scheme_matches;
CREATE TRIGGER trg_scheme_matches_updated_at
BEFORE UPDATE ON scheme_matches
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
