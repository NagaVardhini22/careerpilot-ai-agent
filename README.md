# CareerPilot — AI Career Agent

> **An autonomous AI career agent that evaluates candidate qualifications against real job descriptions, calculates skill compatibility scores, identifies skill gaps, and generates targeted interview preparation strategies using controlled backend tool execution.**

---

### 🌐 Live Demo & Repository

- **Live Application:** [https://careerpilot-ai-agent-production.up.railway.app/](https://careerpilot-ai-agent-production.up.railway.app/)
- **GitHub Repository:** [https://github.com/NagaVardhini22/careerpilot-ai-agent](https://github.com/NagaVardhini22/careerpilot-ai-agent)

---

## Overview

**CareerPilot** is an AI-powered career and job analysis application. Instead of acting as an ungrounded conversational chatbot that guesses answers from prompt text, CareerPilot implements a **controlled, multi-step agent orchestration loop**. 

When a user submits a natural-language career request—such as asking which saved job is their best match and requesting interview questions—the backend agent inspects a registry of controlled tools, autonomously plans and executes discrete steps, reads and writes data to a normalized MySQL database, and returns a verified, data-backed synthesis to the user.

Key design principles of CareerPilot:
1. **Deterministic Data Operations**: The LLM never writes raw SQL or directly accesses the database. All reads, writes, and match calculations are executed through strictly validated backend tool functions.
2. **Normalized Relational Persistence**: Profiles, skill taxonomies, jobs, applications, compatibility analyses, and execution audit logs are stored in a 3NF relational schema in MySQL.
3. **Auditability & Observability**: Every agent run and individual tool call (including arguments, results, status, and duration in milliseconds) is persisted in MySQL and visually presented in the application timeline.
4. **Clean Onboarding State**: Deployed instances start completely empty. Users onboard themselves by creating their candidate profile and saving target roles.

---

## Key Features

- **Candidate Profile Management**: Create and maintain candidate background, headline, education, years of experience, and professional summary.
- **Skills Management**: Select skills from a standardized technical taxonomy and assign proficiency levels (Beginner, Intermediate, Advanced, Expert) with years of experience.
- **Job Opportunity Tracking**: Add, view, search, and delete job listings with structured metadata (title, company, location, work mode, salary range, and required skills).
- **Job Compatibility Analysis**: Calculate algorithmic match percentages, detect satisfied requirements, flag critical skill gaps, and generate strategic recommendations.
- **AI Agent Studio**: An interactive interface where users issue high-level career goals in natural language and observe the agent's multi-step tool execution through an activity timeline.
- **Controlled Tool / Function Calling**: Standards-compliant tool calling with JSON Schema validation and server-side argument enforcement.
- **Interview Question Generation**: Automatically construct targeted technical questions, STAR-method behavioral scenarios, and strategic candidate talking points tailored to the specific intersection of candidate background and role requirements.
- **Job Analysis Persistence**: Persist evaluation outcomes directly to MySQL (`job_analyses`) for historical tracking.
- **Agent Audit Logging**: Detailed relational execution logs for each session (`agent_runs`) and granular tool execution records (`agent_tool_calls`).
- **Clean Onboarding State**: Starts with an empty candidate profile and zero jobs, providing an onboarding flow for new users.
- **Manual Demo Seeding**: Optional one-click demo data loading (`npm run db:seed` or UI button) for local development and technical interview demonstrations.
- **Clean State Reset**: One-click reset functionality (`npm run db:reset` or UI button) to return the database to an empty state instantly.
- **Interactive Dashboard**: Metrics overview displaying total saved jobs, analyzed jobs, average match score, and recent agent runs.
- **Live Cloud Deployment**: Fully deployed and operational on Railway with managed MySQL and secure HTTPS endpoints.

---

## AI Agent Architecture

CareerPilot isolates the reasoning model from direct data storage through a strict layered architecture:

```
Browser (Vanilla JavaScript)
    │
    ▼
Express REST API Router
    │
    ▼
Agent Orchestrator (backend/services/agentService.js)
    │
    ├──▶ LLM / Agent Planner (OpenAI / Gemini / Deterministic Mock)
    │        │
    │        ▼ (Requests Tool Execution via JSON Schema)
    │
    ├──▶ Tool Registry (backend/tools/index.js)
    │        │
    │        ▼ (Validates & Dispatches)
    │
    ├──▶ Controlled Backend Tools (8 Discrete Modules)
    │        │
    │        ▼ (Parameterized Queries & Algorithms)
    │
    ├──▶ MySQL Database (Normalized 3NF Relational Tables)
    │        │
    │        ▼ (Returns Structured Data)
    │
    ├──▶ Tool Results appended to Context & Logged to MySQL
    │        │
    │        ▼ (Next Reasoning Step or Final Synthesis)
    │
Final Structured Markdown Response
    │
    ▼
Browser (Rendered Response + Step-by-Step Activity Timeline)
```

### Why the LLM Does Not Directly Access MySQL

Allowing an LLM to generate and execute raw SQL statements introduces major architectural risks:
- **Security Hazards**: Susceptibility to prompt injections, unintentional table drops, or permission escalations.
- **Data Integrity Failures**: Schema drift, foreign key constraint violations, and invalid JSON formatting.
- **Hallucinated Queries**: Models frequently generate incorrect column names, non-existent tables, or invalid joins.
- **Lack of Business Rule Enforcement**: Business logic (such as weighted match score formulas and proficiency scales) must be enforced by application code, not probabilistic model guesses.

CareerPilot solves this by utilizing **controlled backend tools**. The LLM only indicates *which* tool to invoke and supplies structured parameters. The backend validates parameters, executes parameterized queries via `mysql2/promise`, applies business rules, records execution metrics, and passes clean JSON results back to the model context.

---

## Agent Tooling

The agent tool catalog contains **8 controlled tools** defined in `backend/tools/`:

| Tool Name | Implementation File | Description |
| :--- | :--- | :--- |
| `getCandidateProfile` | `backend/tools/getCandidateProfile.js` | Retrieves the candidate profile details, summary, education, experience, and indexed skills with proficiency levels. |
| `getSavedJobs` | `backend/tools/getSavedJobs.js` | Queries saved job opportunities from MySQL with optional keyword and application status filters. |
| `getJobDetails` | `backend/tools/getJobDetails.js` | Fetches full job specifications, required skills list, and prior analysis history for a specific job ID. |
| `analyzeJobRequirements` | `backend/tools/analyzeJobRequirements.js` | Parses and deconstructs job descriptions into core required skills, preferred qualifications, and experience level criteria. |
| `calculateJobMatch` | `backend/tools/calculateJobMatch.js` | Evaluates candidate skills against job requirements, computes percentage match score, and identifies matched skills and missing skill gaps. |
| `saveJobAnalysis` | `backend/tools/saveJobAnalysis.js` | Persists evaluated match score, matched skills, missing skills, recommendations, and interview readiness into the `job_analyses` table. |
| `generateInterviewQuestions` | `backend/tools/generateInterviewQuestions.js` | Generates role-specific technical questions, STAR-method behavioral questions, and preparation talking points based on candidate profile and job requirements. |
| `getApplicationHistory` | `backend/tools/getApplicationHistory.js` | Retrieves candidate job application tracking records and previous job compatibility evaluations. |

---

## Agent Execution Flow

When a user submits a prompt in the AI Agent Studio, the backend executes the following multi-step loop:

1. **User Request Submission**: The candidate sends a natural-language goal (e.g., *"Which of my saved jobs is the best match for my skills? Prepare interview questions for the best matching job."*).
2. **Run Initialization**: The backend creates an `agent_runs` record in MySQL with `status = 'running'` and initializes conversation context with the system prompt and user request.
3. **Tool Schema Exposure**: All 8 tool definitions (formatted as standard OpenAI function calling JSON schemas) are provided to the LLM/planner.
4. **Model Decision**: The model evaluates conversational context and determines whether it has sufficient information to respond or needs to execute tools.
5. **Tool Validation & Argument Parsing**: When the model requests a tool call, the orchestrator validates that the tool exists in the registry and safely parses arguments.
6. **Tool Execution**: The selected tool module executes with parameterized database queries and business logic.
7. **Execution Audit Logging**: The tool execution is logged in `agent_tool_calls` with tool name, arguments JSON, result payload JSON, status (`success` or `failed`), and duration in milliseconds.
8. **Context Feedback**: The tool output is serialized as a tool response message and appended to the conversation history.
9. **Iterative Continuation**: The agent evaluates accumulated results and can invoke additional tools in sequence (e.g., fetching profile → fetching jobs → calculating match → generating interview questions → saving analysis).
10. **Final Synthesis & Persistence**: Once no further tools are required, the model synthesizes a cohesive, data-backed Markdown answer. The `agent_runs` record is updated with `status = 'completed'`, iteration count, and total duration.
11. **Client Rendering**: The client receives the final Markdown synthesis alongside a step-by-step activity timeline.

> **Loop Safeguard**: The orchestrator enforces a hard limit of `maxIterations = 8` to protect against infinite loops or recursive tool requests.

---

## Technology Stack

### Frontend
- **HTML5**: Semantic layout with accessibility standards (ARIA roles, live regions, responsive viewport).
- **CSS3**: Modern custom properties (CSS variables), Flexbox, CSS Grid, responsive design.
- **Vanilla JavaScript (ES6+)**: Native DOM manipulation, custom event handling, async/await fetch client, zero build-step or framework dependencies.

### Backend
- **Node.js**: Asynchronous event-driven runtime (engines `>=18.0.0`).
- **Express.js**: RESTful API routing, middleware pipeline, static asset serving, and centralized error handling.

### Database
- **MySQL 8.0**: Relational database engine supporting ACID transactions, foreign keys, and JSON columns.
- **`mysql2/promise`**: Promise-based connection pooling, parameterized queries, and SSL/TLS support.

### AI Integration
- **OpenAI API**: Standard function calling (`gpt-4o-mini` or configurable model).
- **Google Gemini API**: Native function declarations and content generation (`gemini-1.5-flash`).
- **Deterministic Mock Planner**: Built-in offline agent planner that follows the exact tool-calling lifecycle without requiring external API keys or incurring costs.

### Development & Tooling
- **npm**: Package management and script automation.
- **Git & GitHub**: Version control, clean commit history, and public repository management.
- **VS Code**: Development environment.

### Deployment & Infrastructure
- **Railway**: Cloud hosting platform for web services and managed databases.
- **Railway Managed MySQL**: Cloud-hosted MySQL database with automated SSL/TLS encryption.
- **HTTPS**: Automated TLS certificate termination provided by Railway.

---

## Database Design & Schema

CareerPilot uses a normalized 3NF relational database schema consisting of **9 tables**, defined in `database/schema.sql`:

```
┌──────────────────┐       1:1       ┌──────────────────────┐
│      users       │ ─────────────── │  candidate_profiles  │
└──────────────────┘                 └──────────────────────┘
         │                                       │
         │ 1:N                                   │ 1:N
         ▼                                       ▼
┌──────────────────┐                 ┌──────────────────────┐
│    agent_runs    │                 │   candidate_skills   │
└──────────────────┘                 └──────────────────────┘
         │                                       │
         │ 1:N                                   │ N:1
         ▼                                       ▼
┌──────────────────┐                 ┌──────────────────────┐
│ agent_tool_calls │                 │        skills        │
└──────────────────┘                 └──────────────────────┘
                                                 │
                                                 │
┌──────────────────┐       1:N       ┌──────────────────────┐
│       jobs       │ ─────────────── │     applications     │
└──────────────────┘                 └──────────────────────┘
         │                                       │
         │ 1:N                                   │
         ▼                                       ▼
┌───────────────────────────────────────────────────────────┐
│                       job_analyses                        │
└───────────────────────────────────────────────────────────┘
```

### Table Descriptions

1. **`users`**: System user records (`id`, `name`, `email`, timestamps).
2. **`candidate_profiles`**: Candidate background, headline, education, years of experience, and summary. Linked to `users` via foreign key.
3. **`skills`**: Standard taxonomy catalog of 26 technical skills categorized across Frontend, Backend, Database, DevOps, AI/ML, and General.
4. **`candidate_skills`**: Composite mapping between candidate profiles and catalog skills, storing proficiency level (`Beginner`, `Intermediate`, `Advanced`, `Expert`) and years of experience.
5. **`jobs`**: Job postings including title, company, location, work mode, salary range, description, and required skills (JSON array).
6. **`applications`**: Application tracking linking candidates and jobs with statuses (`saved`, `applied`, `interviewing`, `offered`, `rejected`).
7. **`job_analyses`**: Match evaluations storing computed `match_score`, `matched_skills` (JSON), `missing_skills` (JSON), `recommendations` (JSON), and `interview_readiness`.
8. **`agent_runs`**: High-level audit log of agent execution sessions storing user request, completion status, iteration count, duration, and final response.
9. **`agent_tool_calls`**: Fine-grained execution log of each individual tool invocation within an agent run, including arguments, results, status, and duration in milliseconds.

### Clean Empty State vs. Manual Demo Seeding

- **`npm run db:init`**: Executes `database/schema.sql`. It creates the 9 tables and populates only the base skills taxonomy (`skills`). It inserts **zero** users, candidate profiles, jobs, applications, analyses, or agent runs. The deployed application runs in this clean state.
- **`npm run db:seed`**: Explicit manual command for local testing and interview demos. Executes `database/seed.sql` to populate sample jobs and candidate records. It is never triggered automatically during application startup.

---

## Project Structure

```
careerpilot-ai-agent/
├── backend/
│   ├── config/
│   │   ├── db.js                   # MySQL connection pool & parameterized query helper
│   │   └── env.js                  # Environment variable configuration & fallbacks
│   ├── controllers/
│   │   ├── agentController.js      # Controller for agent execution & run history
│   │   ├── analysisController.js   # Controller for stats, analyses, and demo toggles
│   │   ├── jobController.js        # Controller for job CRUD and direct analysis
│   │   └── profileController.js    # Controller for candidate profile and skills
│   ├── middleware/
│   │   └── errorHandler.js         # Centralized HTTP error handler
│   ├── routes/
│   │   ├── agentRoutes.js          # /api/agent endpoints
│   │   ├── analysisRoutes.js       # /api/analyses, /api/stats, /api/demo endpoints
│   │   ├── jobRoutes.js            # /api/jobs endpoints
│   │   └── profileRoutes.js        # /api/profile endpoints
│   ├── services/
│   │   ├── agentService.js         # Agent Orchestration Loop & run manager
│   │   ├── jobService.js           # Job CRUD and evaluation service
│   │   ├── llmService.js           # Modular LLM client (OpenAI / Gemini / Mock Planner)
│   │   └── profileService.js       # Candidate profile and skills service
│   ├── test/
│   │   └── runTests.js             # Automated 23-test verification suite
│   ├── tools/
│   │   ├── analyzeJobRequirements.js
│   │   ├── calculateJobMatch.js
│   │   ├── generateInterviewQuestions.js
│   │   ├── getApplicationHistory.js
│   │   ├── getCandidateProfile.js
│   │   ├── getJobDetails.js
│   │   ├── getSavedJobs.js
│   │   ├── index.js                # Tool Registry & Execution Dispatcher
│   │   └── saveJobAnalysis.js
│   └── server.js                   # Express server entry point & static file hosting
├── database/
│   ├── initDb.js                   # Script to initialize clean, empty database schema
│   ├── schema.sql                  # 9-table MySQL relational schema
│   ├── seed.sql                    # Manual demo data for testing and demonstrations
│   └── seedDb.js                   # Script to manually seed demo data
├── frontend/
│   ├── css/
│   │   └── styles.css              # Responsive custom dark theme styling
│   ├── js/
│   │   ├── agent.js                # AI Agent Studio controller & activity stepper
│   │   ├── api.js                  # Reusable native fetch REST API client
│   │   ├── app.js                  # Application state, tab navigation, event binding
│   │   └── ui.js                   # UI rendering helpers, modals, and toasts
│   └── index.html                  # Accessible semantic single-page dashboard
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules (protects .env and dependencies)
├── package.json                    # Dependencies, scripts, and Node engine constraints
└── README.md                       # Project documentation
```

---

## Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **MySQL**: `8.0` or higher running locally on port `3306`

### 1. Clone the Repository
```bash
git clone https://github.com/NagaVardhini22/careerpilot-ai-agent.git
cd careerpilot-ai-agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root by copying the template:
```bash
cp .env.example .env
```
Open `.env` and fill in your local MySQL credentials. The `.env` file is gitignored and will never be tracked by version control.

### 4. Initialize the Database
Run the initialization script to create the 9 tables:
```bash
npm run db:init
```
*(This creates an empty schema with 0 candidate profiles and 0 jobs).*

### 5. Start the Application
Start the server in standard mode:
```bash
npm start
```
Or start in development mode with hot-reloading:
```bash
npm run dev
```

Open your browser and navigate to: **`http://localhost:3000`**

---

## Environment Variables

The application reads configuration through environment variables (defined in `backend/config/env.js` and referenced in `.env.example`):

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Port on which Express listens (default: `3000`, dynamically provided by Railway). |
| `NODE_ENV` | Optional | Application runtime environment (`development` or `production`). |
| `DATABASE_URL` / `MYSQL_URL` | Optional | Full MySQL connection URI (used by cloud providers like Railway). |
| `DB_HOST` | Required* | MySQL server hostname (default: `localhost`). |
| `DB_PORT` | Required* | MySQL server port (default: `3306`). |
| `DB_USER` | Required* | MySQL user account. |
| `DB_PASSWORD` | Required* | MySQL user password. |
| `DB_NAME` | Required* | Target MySQL database name (default: `careerpilot_db`). |
| `DB_SSL` / `MYSQL_SSL` | Optional | Set to `true` to enable SSL/TLS encryption for managed cloud MySQL. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Optional | Set to `false` for cloud hosts using self-signed certificates. |
| `LLM_PROVIDER` | Optional | AI provider selection: `mock` (default offline), `openai`, or `gemini`. |
| `LLM_API_KEY` | Optional | API key for OpenAI or Gemini (not needed when using `mock`). |
| `LLM_MODEL` | Optional | Target model name (e.g., `gpt-4o-mini`, `gemini-1.5-flash`). |

*\* Note: When `DATABASE_URL` is supplied, discrete database parameters (`DB_HOST`, `DB_PORT`, etc.) are not required.*

---

## Database Initialization & Seed Controls

CareerPilot provides clear, explicit commands for database state management:

### Initialize Clean State (Default)
```bash
npm run db:init
```
- Creates all 9 tables if they do not exist.
- Populates the standard taxonomy of 26 technical skills.
- Leaves all candidate profiles, jobs, applications, analyses, and agent runs completely empty (**0 rows**).

### Seed Demo Data (Manual / Development Only)
```bash
npm run db:seed
```
- Populates a generic demo candidate, 6 realistic job opportunities, and sample history.
- Can also be triggered via the **"Load Demo Data"** button in the web interface.

### Reset Clean State
```bash
npm run db:reset
```
- Drops existing tables and re-executes `schema.sql`.
- Can also be triggered via the **"Reset Clean State"** button in the web interface.

---

## Testing

CareerPilot includes an automated end-to-end verification suite in `backend/test/runTests.js`.

To run the verification suite:
```bash
npm test
```

### Verified Test Results (23 Passed, 0 Failed)

The automated test suite verifies 9 functional domains against a live server:

```text
====================================================
🧪 Starting CareerPilot Automated Verification Suite
📡 Target Backend: http://localhost:3000
====================================================

▶ 1. Healthcheck & Database Connection
  ✅ PASS: Server is online
  ✅ PASS: Database is connected

▶ 2. Fresh Empty State Verification
  ✅ PASS: Profile is null in clean state
  ✅ PASS: Zero jobs in clean state
  ✅ PASS: Stats reflect zero jobs

▶ 3. Agent Execution on Empty Profile
  ✅ PASS: Agent handles empty state without crashing
  ✅ PASS: Agent advises candidate to create profile

▶ 4. Candidate Profile Creation
  ✅ PASS: Profile created with HTTP 201
  ✅ PASS: Profile ID returned
  ✅ PASS: Skills cataloged correctly

▶ 5. Job Creation & Retrieval
  ✅ PASS: Job created with HTTP 201
  ✅ PASS: Job ID generated

▶ 6. Direct Job Compatibility Analysis
  ✅ PASS: Analysis successful
  ✅ PASS: Match score computed (> 70%)
  ✅ PASS: Matched skills identified

▶ 7. Autonomous Agent Loop Execution
  ✅ PASS: Agent completed workflow
  ✅ PASS: Multiple iterations logged
  ✅ PASS: Activity steps recorded
  ✅ PASS: Final response synthesized

▶ 8. Agent Audit Log & Tool Call Persistence
  ✅ PASS: Run retrieved from MySQL
  ✅ PASS: Granular tool calls recorded in agent_tool_calls

▶ 9. Error Handling Verification
  ✅ PASS: Empty request rejected with 400
  ✅ PASS: Invalid Job ID rejected with 404

====================================================
📊 Test Summary: 23 Passed, 0 Failed
====================================================
```

---

## Deployment on Railway

CareerPilot is deployed as a single production web service on **Railway**:

- **Web Service**: A Node.js/Express web service that serves the responsive Vanilla JavaScript frontend and the REST API.
- **Database Service**: A dedicated **Railway Managed MySQL** instance.
- **Database Connectivity**: The Node.js backend connects to the Railway Managed MySQL database using environment-based configuration and secure database connectivity.
- **HTTPS Endpoint**: Railway automatically handles SSL/TLS termination and routes inbound traffic over public HTTPS.

**Live Production URL:**  
[https://careerpilot-ai-agent-production.up.railway.app/](https://careerpilot-ai-agent-production.up.railway.app/)

---

## Security Practices

- **Strict Environment Isolation**: Sensitive keys (`LLM_API_KEY`, database credentials) reside exclusively on the server in `.env` (or cloud dashboard environment variables). No credentials are sent to or exposed in client bundles.
- **Version Control Protection**: `.env` and credential files are strictly ignored in `.gitignore`. Tracked files are verified through automated secret scans.
- **Parameterized SQL Queries**: All database queries use parameterized placeholders (`?`) executed via `mysql2/promise`. Input parameters are never concatenated into SQL strings, reducing SQL injection risk through parameterized queries.
- **Sandboxed Agent Tools**: The LLM cannot execute raw shell commands or arbitrary database queries. It can only request execution of registered, type-checked tool functions.
- **Input & Parameter Validation**: Tool arguments are parsed and sanitized before execution. Empty requests or invalid identifiers receive clean HTTP error responses (`400`, `404`) without leaking stack traces.
- **Iteration Limits**: A hard execution safeguard of `maxIterations = 8` terminates any cyclic reasoning loops.

---

## Demo & Interview Walkthrough

An interviewer can evaluate the end-to-end functionality in under 3 minutes:

1. **Open the Live Application**: Visit [https://careerpilot-ai-agent-production.up.railway.app/](https://careerpilot-ai-agent-production.up.railway.app/).
2. **Review the Empty Onboarding State**: Observe the dashboard and notice that candidate profiles and jobs start at zero.
3. **Create a Candidate Profile**: Click the **Profile** tab in the sidebar. Enter a professional headline, years of experience, education, and add technical skills (e.g., *JavaScript*, *Node.js*, *MySQL*, *Express.js*). Save the profile.
4. **Save a Job Opportunity**: Navigate to the **Jobs Board** and click **Add New Job**. Enter a role (e.g., *Full Stack Developer* at *Stripe* requiring *JavaScript, Node.js, REST APIs, and MySQL*).
5. **Open AI Agent Studio**: Navigate to the **AI Agent Studio** tab.
6. **Submit a Career Request**: Enter a prompt such as:
   > *"Analyze my saved jobs and tell me which job is the best match for my skills. Then prepare interview questions for the best matching job."*
7. **Observe Autonomous Tool Execution**: Watch the activity timeline as the agent invokes:
   - `getCandidateProfile`
   - `getSavedJobs`
   - `calculateJobMatch`
   - `generateInterviewQuestions`
   - `saveJobAnalysis`
8. **Inspect Results & History**: Read the synthesized evaluation and tailored interview questions in the response card. Navigate to **Agent Runs** to view the full audit record and timestamps.
9. **Explore Reset / Demo Utilities**: Test the **"Reset Clean State"** or **"Load Demo Data"** actions in the sidebar to observe programmatic database state transitions.

---

## Why This Project

This project was built to demonstrate full-stack engineering proficiency and practical AI systems design:

- **Clean Layered Architecture**: Clear separation of concerns between HTTP Controllers, Business Logic Services, Agent Orchestration, Tool Execution, and Database Persistence.
- **Autonomous Agent Implementation**: Demonstrates how an AI model can interact with real databases and business logic through structured tool calling rather than basic chat completion.
- **Production Relational Data Modeling**: A normalized 3NF schema in MySQL with foreign key cascades, JSON data types, and indexed queries.
- **Core Web Fundamentals**: Demonstrates full UI capability using semantic HTML5, modern CSS3, and native Vanilla JavaScript without relying on heavy frameworks.
- **Production Deployment**: Cloud deployment on Railway with managed MySQL, dynamic SSL configuration, and environment-driven architecture.
- **Comprehensive Verification**: 23 automated tests covering health checks, empty state handling, profile management, job scoring, agent loops, audit logging, and error boundaries.

---

## Future Improvements

Planned future enhancements include:
- **Streaming Responses (SSE)**: Implement Server-Sent Events to stream LLM tokens and live tool execution steps in real time.
- **Resume PDF Parser**: Allow candidates to upload resume files and automatically extract skills and experience into the database.
- **Semantic Vector Search**: Integrate vector embeddings (e.g., pgvector or Milvus) to support semantic matching alongside deterministic keyword matching.
- **Multi-Tenant User Authentication**: Add JWT or session-based authentication to support isolated multi-user environments.
- **Asynchronous Agent Queue**: Offload intensive agent workflows to a Redis-backed background worker queue (e.g., BullMQ).
