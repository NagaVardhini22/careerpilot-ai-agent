-- ============================================================================
-- CareerPilot - Optional Development / Demo Seed Script
-- WARNING: This is for development and manual testing only.
-- Do NOT execute this automatically during application startup.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE agent_tool_calls;
TRUNCATE TABLE agent_runs;
TRUNCATE TABLE job_analyses;
TRUNCATE TABLE applications;
TRUNCATE TABLE candidate_skills;
TRUNCATE TABLE jobs;
TRUNCATE TABLE candidate_profiles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Insert Generic Demo User
-- ----------------------------------------------------------------------------
INSERT INTO users (id, name, email) VALUES
(1, 'Alex Morgan', 'alex.morgan@careerpilot.demo');

-- ----------------------------------------------------------------------------
-- 2. Insert Generic Demo Profile
-- ----------------------------------------------------------------------------
INSERT INTO candidate_profiles (id, user_id, headline, summary, education, experience_years) VALUES
(1, 1, 
 'Full-Stack Software Engineer | Node.js, Express, MySQL & Modern Web',
 'Versatile full-stack engineer with 3.5 years of experience building resilient backend APIs, scalable relational database architectures with MySQL, and responsive frontend interfaces. Passionate about AI agent systems, clean software architecture, and developer productivity.',
 'B.S. in Computer Science, 2022',
 3.5);

-- ----------------------------------------------------------------------------
-- 3. Candidate Skills for Demo
-- ----------------------------------------------------------------------------
INSERT INTO candidate_skills (candidate_id, skill_id, proficiency_level, years_of_experience) VALUES
(1, 1, 'Expert', 3.5),        -- JavaScript
(1, 2, 'Expert', 3.5),        -- HTML5
(1, 3, 'Advanced', 3.5),      -- CSS3
(1, 7, 'Expert', 3.5),        -- Node.js
(1, 8, 'Expert', 3.0),        -- Express.js
(1, 9, 'Expert', 3.5),        -- REST APIs
(1, 12, 'Advanced', 3.0),     -- MySQL
(1, 13, 'Advanced', 3.0),     -- SQL
(1, 22, 'Advanced', 3.5),     -- Git
(1, 5, 'Intermediate', 1.5),  -- React
(1, 17, 'Intermediate', 1.5), -- Docker
(1, 21, 'Intermediate', 2.0), -- Linux
(1, 23, 'Advanced', 2.5),     -- Unit Testing
(1, 25, 'Intermediate', 1.0), -- OpenAI API
(1, 26, 'Intermediate', 1.0); -- Agentic Workflows

-- ----------------------------------------------------------------------------
-- 4. Realistic Demo Jobs
-- ----------------------------------------------------------------------------
INSERT INTO jobs (id, user_id, title, company, location, work_mode, salary_range, description, required_skills, experience_required, status) VALUES
(1, 1, 
 'Full-Stack Software Engineer (Node.js & MySQL)', 
 'CloudScale Technologies', 
 'San Francisco, CA (Remote)', 
 'Remote', 
 '$115,000 - $135,000', 
 'We are looking for a Full-Stack Software Engineer to build robust backend microservices and responsive web dashboards. You will design normalized relational database schemas using MySQL, build performant RESTful APIs using Node.js and Express.js, and collaborate with product teams on high-throughput business applications.', 
 '["JavaScript", "Node.js", "Express.js", "MySQL", "REST APIs", "Git", "HTML5", "CSS3"]', 
 '2-4 years', 
 'saved'),

(2, 1, 
 'Backend API Engineer (Node.js / Express)', 
 'FinTech Horizon', 
 'New York, NY (Hybrid)', 
 'Hybrid', 
 '$125,000 - $145,000', 
 'FinTech Horizon is scaling its core payments processing pipeline. We require a specialized Backend Engineer experienced in building fault-tolerant Node.js & Express REST APIs, writing optimized SQL queries and transactions in MySQL, managing Git workflows, and implementing security best practices.', 
 '["Node.js", "Express.js", "MySQL", "SQL", "REST APIs", "Git", "Unit Testing", "Redis"]', 
 '3-5 years', 
 'saved'),

(3, 1, 
 'Frontend Specialist (Vanilla JS & Modern Web)', 
 'PixelCraft Interactive', 
 'Austin, TX (Remote)', 
 'Remote', 
 '$100,000 - $120,000', 
 'PixelCraft crafts high-performance web products without framework bloat. We seek a passionate Frontend Engineer with deep mastery of Vanilla JavaScript (ES6+), semantic HTML5, modern CSS3 layout systems (Grid, Flexbox), and clean REST API data consumption.', 
 '["JavaScript", "HTML5", "CSS3", "REST APIs", "Git", "Responsive Design"]', 
 '2-4 years', 
 'saved'),

(4, 1, 
 'Cloud DevOps & Platform Engineer', 
 'InfraNexus Systems', 
 'Seattle, WA (On-site)', 
 'On-site', 
 '$140,000 - $165,000', 
 'InfraNexus is expanding our cloud reliability team. In this role, you will architect Kubernetes clusters, automate multi-region CI/CD pipelines, configure AWS infrastructure as code using Terraform, and monitor production reliability with Prometheus and Grafana.', 
 '["Kubernetes", "AWS", "Docker", "CI/CD", "Linux", "Terraform", "Python"]', 
 '4-6 years', 
 'saved'),

(5, 1, 
 'Junior Web Application Developer', 
 'LaunchPad Digital', 
 'Chicago, IL (Remote)', 
 'Remote', 
 '$75,000 - $90,000', 
 'LaunchPad Digital welcomes an enthusiastic Web Developer to build client portals and internal web apps. Must be proficient in HTML5, CSS3, JavaScript, connecting to REST endpoints, and basic database concepts with SQL/MySQL.', 
 '["HTML5", "CSS3", "JavaScript", "REST APIs", "Git", "MySQL"]', 
 '1-2 years', 
 'saved'),

(6, 1, 
 'AI Systems & Agent Engineer', 
 'NeuroSynth Labs', 
 'Boston, MA (Hybrid)', 
 'Hybrid', 
 '$130,000 - $155,000', 
 'Join NeuroSynth Labs to develop cutting-edge autonomous AI agent orchestrators, tool/function-calling pipelines, and LLM-assisted workflow automation. You will integrate modern LLM APIs, manage stateful agent loops, and connect external tool APIs.', 
 '["JavaScript", "Node.js", "Python", "OpenAI API", "Agentic Workflows", "REST APIs", "Git"]', 
 '2-4 years', 
 'saved');

-- ----------------------------------------------------------------------------
-- 5. Applications for Demo
-- ----------------------------------------------------------------------------
INSERT INTO applications (id, job_id, candidate_id, status, applied_date, notes) VALUES
(1, 1, 1, 'applied', '2026-02-15', 'Submitted resume and portfolio. Reached out to hiring manager on LinkedIn.'),
(2, 2, 1, 'interviewing', '2026-02-20', 'Passed initial recruiter screen. Technical interview scheduled.');
