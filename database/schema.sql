-- ============================================================================
-- CareerPilot - Clean Production Database Schema (EMPTY STATE)
-- Database: careerpilot_db
-- ============================================================================

CREATE DATABASE IF NOT EXISTS careerpilot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE careerpilot_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS agent_tool_calls;
DROP TABLE IF EXISTS agent_runs;
DROP TABLE IF EXISTS job_analyses;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS candidate_skills;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS candidate_profiles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Users Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Candidate Profiles Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    headline VARCHAR(200) NOT NULL,
    summary TEXT,
    education VARCHAR(255),
    experience_years DECIMAL(3, 1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cp_user (user_id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Skills Table (Standard taxonomy of cataloged skills)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    category ENUM('Frontend', 'Backend', 'Database', 'DevOps', 'AI/ML', 'General') DEFAULT 'General',
    INDEX idx_skill_name (name)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Candidate Skills Table (Many-to-Many candidate skill mapping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert') DEFAULT 'Intermediate',
    years_of_experience DECIMAL(3, 1) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_candidate_skill (candidate_id, skill_id),
    CONSTRAINT fk_cs_candidate FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Jobs Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL, -- Allows jobs to be owned by a user
    title VARCHAR(150) NOT NULL,
    company VARCHAR(150) NOT NULL,
    location VARCHAR(150) DEFAULT 'Remote',
    work_mode ENUM('Remote', 'Hybrid', 'On-site') DEFAULT 'Remote',
    salary_range VARCHAR(80),
    description TEXT NOT NULL,
    required_skills JSON NOT NULL, -- Stored as JSON array: ["JavaScript", "Node.js"]
    experience_required VARCHAR(50) DEFAULT '2-4 years',
    status ENUM('saved', 'applied', 'archived') DEFAULT 'saved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_title (title)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. Applications Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    candidate_id INT NOT NULL,
    status ENUM('saved', 'applied', 'interviewing', 'offered', 'rejected') DEFAULT 'applied',
    applied_date DATE DEFAULT (CURRENT_DATE),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    INDEX idx_app_status (status)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. Job Analyses Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_analyses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    candidate_id INT NOT NULL,
    match_score INT NOT NULL,
    matched_skills JSON NOT NULL,
    missing_skills JSON NOT NULL,
    key_strengths JSON,
    recommendations JSON NOT NULL,
    interview_readiness VARCHAR(50) DEFAULT 'Moderate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ja_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_ja_candidate FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    INDEX idx_ja_score (match_score)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. Agent Runs Table (Audit log of agent execution sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_request TEXT NOT NULL,
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    final_response LONGTEXT,
    error_message TEXT,
    total_iterations INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_ar_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_ar_status (status),
    INDEX idx_ar_created (created_at)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. Agent Tool Calls Table (Fine-grained tool audit log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSON NOT NULL,
    result JSON,
    status ENUM('success', 'failed') DEFAULT 'success',
    execution_time_ms INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_atc_run FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
    INDEX idx_atc_tool (tool_name)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- Populate Standard Skills Taxonomy (Universal skill catalog only)
-- No user data, no profiles, no jobs.
-- ----------------------------------------------------------------------------
INSERT INTO skills (name, category) VALUES
('JavaScript', 'Frontend'),
('HTML5', 'Frontend'),
('CSS3', 'Frontend'),
('TypeScript', 'Frontend'),
('React', 'Frontend'),
('Tailwind CSS', 'Frontend'),
('Node.js', 'Backend'),
('Express.js', 'Backend'),
('REST APIs', 'Backend'),
('GraphQL', 'Backend'),
('Microservices', 'Backend'),
('MySQL', 'Database'),
('SQL', 'Database'),
('PostgreSQL', 'Database'),
('MongoDB', 'Database'),
('Redis', 'Database'),
('Docker', 'DevOps'),
('Kubernetes', 'DevOps'),
('AWS', 'DevOps'),
('CI/CD', 'DevOps'),
('Linux', 'General'),
('Git', 'General'),
('Unit Testing', 'General'),
('Python', 'AI/ML'),
('OpenAI API', 'AI/ML'),
('Agentic Workflows', 'AI/ML')
ON DUPLICATE KEY UPDATE name=VALUES(name);
