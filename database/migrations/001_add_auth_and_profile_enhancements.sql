-- ============================================================================
-- Migration: 001_add_auth_and_profile_enhancements.sql
-- Description: Non-destructive schema migration for CareerPilot
-- Adds authentication fields, profile qualification details, legacy flags,
-- nullable skill experience, and external job discovery metadata.
--
-- NOTE: For automated idempotent execution with column and index existence
-- checks, use the migration runner: `node database/migrate.js`
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Users Table Enhancements
-- ----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL AFTER updated_at;

-- ----------------------------------------------------------------------------
-- 2. Candidate Profiles Table Enhancements
-- ----------------------------------------------------------------------------
ALTER TABLE candidate_profiles ADD COLUMN qualification VARCHAR(100) NULL AFTER summary;
ALTER TABLE candidate_profiles ADD COLUMN field_of_study VARCHAR(150) NULL AFTER qualification;
ALTER TABLE candidate_profiles ADD COLUMN institution VARCHAR(200) NULL AFTER field_of_study;
ALTER TABLE candidate_profiles ADD COLUMN graduation_year INT NULL AFTER institution;
ALTER TABLE candidate_profiles ADD COLUMN is_legacy BOOLEAN NOT NULL DEFAULT FALSE AFTER graduation_year;

-- ----------------------------------------------------------------------------
-- 3. Candidate Skills Table Enhancements
-- ----------------------------------------------------------------------------
ALTER TABLE candidate_skills MODIFY COLUMN proficiency_level ENUM('Not specified', 'Beginner', 'Intermediate', 'Advanced', 'Expert') NOT NULL DEFAULT 'Not specified';
ALTER TABLE candidate_skills MODIFY COLUMN years_of_experience DECIMAL(3, 1) NULL DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 4. Jobs Table Enhancements
-- ----------------------------------------------------------------------------
ALTER TABLE jobs ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT FALSE AFTER status;
ALTER TABLE jobs ADD COLUMN external_id VARCHAR(100) NULL AFTER is_external;
ALTER TABLE jobs ADD COLUMN source_name VARCHAR(100) NULL AFTER external_id;
ALTER TABLE jobs ADD COLUMN original_url TEXT NULL AFTER source_name;

-- ----------------------------------------------------------------------------
-- 5. Foreign Key & Query Performance Indexes
-- ----------------------------------------------------------------------------
ALTER TABLE jobs ADD INDEX idx_jobs_user (user_id);
-- idx_cp_user is standard on candidate_profiles(user_id); add if not already present
-- ALTER TABLE candidate_profiles ADD INDEX idx_cp_user (user_id);
ALTER TABLE agent_runs ADD INDEX idx_ar_user (user_id);
