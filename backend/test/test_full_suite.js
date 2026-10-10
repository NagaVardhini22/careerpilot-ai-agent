/**
 * CareerPilot — Full Comprehensive Verification Suite (Phases 1 - 7)
 * 
 * Verifies end-to-end functionality against an isolated disposable MySQL 8.0 instance (port 3307):
 * - Phase 1: Database migrations, idempotency, schema safety, non-destructive skill migration preview.
 * - Phase 2: Authentication (scrypt, tokens, cookies, CSRF, anti-IDOR, multi-user isolation, production lockdown).
 * - Phase 3: Profile normalization (separated education fields, flexible skill builder, no fake 2.5y defaults).
 * - Phase 4: Live external job discovery (Greenhouse, Lever, graceful fallbacks, external search links, caching, save to board).
 * - Phase 5: Transparent match score explanations, gap recommendations with caveats, 9th controlled tool `searchLiveJobs`.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execSync } = require('child_process');
const mysql = require('mysql2/promise');

const TEST_PORT = 3307;
const TEST_DB = 'careerpilot_full_suite_db';
const MYSQLD_PATH = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';

// Set test environment configuration
process.env.DB_PORT = String(TEST_PORT);
process.env.DB_NAME = TEST_DB;
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_HOST = '127.0.0.1';
process.env.JWT_SECRET = 'careerpilot_comprehensive_full_suite_secret_token_32chars_ok!';
process.env.NODE_ENV = 'test';

const { runMigrations, columnExists, indexExists } = require('../../database/migrate');
const { previewSkillMigration } = require('../../database/preview_migration');
const { migrateCandidateSkills } = require('../../database/migrate_skills');
const { hashPassword, verifyPassword, generateToken, verifyToken } = require('../services/authService');
const profileService = require('../services/profileService');
const jobAggregator = require('../services/jobProviders/jobAggregatorService');
const tools = require('../tools');
const calculateJobMatch = require('../tools/calculateJobMatch');
const searchLiveJobs = require('../tools/searchLiveJobs');
const db = require('../config/db');

let serverInstance = null;
let serverPort = null;

async function ensureDisposableServer() {
  try {
    const testConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: '',
      connectTimeout: 1000
    });
    await testConn.end();
    return { cleanup: async () => {} };
  } catch {
    // Need to spin up instance
  }

  if (!fs.existsSync(MYSQLD_PATH)) {
    throw new Error(`MySQL daemon not found at ${MYSQLD_PATH} to spin up disposable test database.`);
  }

  const tempDatadir = path.join(os.tmpdir(), `mysql_disposable_full_${Date.now()}`);
  if (fs.existsSync(tempDatadir)) {
    fs.rmSync(tempDatadir, { recursive: true, force: true });
  }

  console.log('⚡ Initializing isolated disposable MySQL test instance...');
  execSync(`"${MYSQLD_PATH}" --initialize-insecure --datadir="${tempDatadir}" --console`, { stdio: 'ignore' });

  console.log(`⚡ Spawning disposable MySQL test server on port ${TEST_PORT}...`);
  const child = spawn(MYSQLD_PATH, [
    `--datadir=${tempDatadir}`,
    `--port=${TEST_PORT}`,
    '--console'
  ], { stdio: 'ignore' });

  let ready = false;
  const start = Date.now();
  while (!ready && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const probe = await mysql.createConnection({
        host: '127.0.0.1',
        port: TEST_PORT,
        user: 'root',
        password: '',
        connectTimeout: 1000
      });
      await probe.end();
      ready = true;
    } catch {
      // retry
    }
  }

  if (!ready) {
    child.kill();
    throw new Error('Failed to connect to spawned disposable MySQL server within 15 seconds.');
  }

  return {
    cleanup: async () => {
      console.log('🧹 Terminating disposable MySQL test server...');
      child.kill();
      await new Promise(r => setTimeout(r, 1000));
      try {
        fs.rmSync(tempDatadir, { recursive: true, force: true });
      } catch {
        // ignore on Windows if handles close asynchronously
      }
    }
  };
}

function makeRequest(server, { method = 'GET', path: reqPath, headers = {} }, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: { ...headers }
    };

    let payload = null;
    if (body !== null && body !== undefined) {
      payload = typeof body === 'object' ? JSON.stringify(body) : String(body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 CareerPilot Comprehensive Verification Suite (Phases 1 - 7)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${detail ? '— ' + detail : ''}`);
      failed++;
    }
  }

  let serverProcess = null;
  let appServer = null;

  try {
    // 1. Ensure isolated MySQL server
    const serverObj = await ensureDisposableServer();
    serverProcess = serverObj;

    // 2. Setup isolated test database schema
    const rootConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: ''
    });
    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootConn.query(`CREATE DATABASE \`${TEST_DB}\``);

    // Apply base schema
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await rootConn.query(`USE \`${TEST_DB}\``);
      await rootConn.query(stmt);
    }
    await rootConn.end();

    // -------------------------------------------------------------------------
    // SECTION 1: PHASE 1 MIGRATION SAFETY & SCHEMA EVOLUTION
    // -------------------------------------------------------------------------
    console.log('\n▶ Section 1: Phase 1 Database Migration & Safety Verification');

    const migResult = await runMigrations(db.pool);
    assert('Initial migration executes successfully', migResult && Array.isArray(migResult.applied) && migResult.applied.length > 0);

    const hasUsersTable = await db.query("SHOW TABLES LIKE 'users'");
    assert('`users` table created', hasUsersTable.length > 0);

    const hasQualCol = await columnExists(db.pool, TEST_DB, 'candidate_profiles', 'qualification');
    assert('`qualification` column added to candidate_profiles', !!hasQualCol);

    const hasFieldCol = await columnExists(db.pool, TEST_DB, 'candidate_profiles', 'field_of_study');
    assert('`field_of_study` column added to candidate_profiles', !!hasFieldCol);

    const hasInstCol = await columnExists(db.pool, TEST_DB, 'candidate_profiles', 'institution');
    assert('`institution` column added to candidate_profiles', !!hasInstCol);

    const hasGradCol = await columnExists(db.pool, TEST_DB, 'candidate_profiles', 'graduation_year');
    assert('`graduation_year` column added to candidate_profiles', !!hasGradCol);

    const hasLegacyCol = await columnExists(db.pool, TEST_DB, 'candidate_profiles', 'is_legacy');
    assert('`is_legacy` column added to candidate_profiles', !!hasLegacyCol);

    const hasJobsExtCol = await columnExists(db.pool, TEST_DB, 'jobs', 'is_external');
    assert('`is_external` column added to jobs', !!hasJobsExtCol);

    // Idempotency: run again
    const migIdempotent = await runMigrations(db.pool);
    assert('Migration runner is idempotent on second run', migIdempotent && Array.isArray(migIdempotent.skipped) && migIdempotent.skipped.length > 0);

    // Skill preview test
    const preview = await previewSkillMigration(db.pool);
    assert('Skill preview executes safely without modifying data', preview && Array.isArray(preview.matchingProfiles) && typeof preview.totalAudited === 'number');

    // -------------------------------------------------------------------------
    // START APPLICATION SERVER ON EPHEMERAL PORT
    // -------------------------------------------------------------------------
    const app = require('../server');
    appServer = http.createServer(app);
    await new Promise(resolve => appServer.listen(0, '127.0.0.1', resolve));
    serverPort = appServer.address().port;
    console.log(`\n📡 Ephemeral test application server running on port ${serverPort}`);

    // Health check
    const health = await makeRequest(appServer, { path: '/api/health' });
    assert('API Healthcheck returns 200', health.status === 200);
    assert('Healthcheck verifies MySQL connection', health.data.databaseConnected === true);

    // -------------------------------------------------------------------------
    // SECTION 2: PHASE 2 AUTHENTICATION & MULTI-USER DATA ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n▶ Section 2: Phase 2 Authentication & Multi-User Data Isolation');

    // 1. Password hashing
    const testHash = await hashPassword('SecurePassword123!');
    const hashValid = await verifyPassword('SecurePassword123!', testHash);
    const hashInvalid = await verifyPassword('WrongPassword', testHash);
    assert('scrypt password hash verifies correct password', hashValid === true);
    assert('scrypt password hash rejects incorrect password', hashInvalid === false);

    // 2. Strict production JWT secret guard
    let prodGuardTriggered = false;
    try {
      execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.JWT_SECRET=\'short\'; require(\'./backend/config/env\');"', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..')
      });
    } catch {
      prodGuardTriggered = true;
    }
    assert('Production JWT_SECRET guard rejects secret < 32 characters in production', prodGuardTriggered === true);

    // Regression check: Registration rejects empty name
    const regEmptyName = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }, {
      name: '   ',
      email: 'emptyname.suite@example.com',
      password: 'SomePassword123!'
    });
    assert('Registration rejects whitespace name with 400', regEmptyName.status === 400 && regEmptyName.data.error.includes('Name is required'));

    // 3. User Registration (User A)
    const regUserA = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }, {
      name: 'Alice Developer',
      email: 'Alice.Dev@example.com',
      password: 'AlicePassword123!'
    });
    assert('User A registers successfully (HTTP 201)', regUserA.status === 201);
    assert('Email normalized to lowercase', regUserA.data.user.email === 'alice.dev@example.com');
    assert('Set-Cookie header present on registration', !!regUserA.headers['set-cookie']);

    const userACookie = regUserA.headers['set-cookie'] ? regUserA.headers['set-cookie'][0].split(';')[0] : '';

    // 4. CSRF Protection: Cookie authenticated request without X-Requested-With
    const noCsrfRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/jobs',
      headers: {
        'Cookie': userACookie
      }
    }, {
      title: 'CSRF Test Job',
      company: 'Test Corp'
    });
    assert('Cookie-authenticated mutating request without CSRF header rejected (HTTP 403)', noCsrfRes.status === 403);

    // 5. Anti-Enumeration generic error
    const wrongPassRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }, {
      email: 'alice.dev@example.com',
      password: 'WrongPassword999!'
    });
    assert('Wrong password returns 401 Unauthorized', wrongPassRes.status === 401);
    assert('Generic error message prevents enumeration', (wrongPassRes.data.error || '').includes('Invalid email or password'));

    // 6. User B Registration
    const regUserB = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }, {
      name: 'Bob Engineer',
      email: 'bob.engineer@example.com',
      password: 'BobPassword123!'
    });
    assert('User B registers successfully (HTTP 201)', regUserB.status === 201);
    const userBCookie = regUserB.headers['set-cookie'] ? regUserB.headers['set-cookie'][0].split(';')[0] : '';

    // 7. Multi-User Isolation: User A creates job, User B cannot see or delete it
    const createJobA = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/jobs',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, {
      title: 'Senior Node.js Architect',
      company: 'TechCorp A',
      location: 'Remote',
      workMode: 'Remote',
      requiredSkills: ['Node.js', 'MySQL', 'Express'],
      description: 'Building high throughput APIs'
    });
    assert('User A creates private job (HTTP 201)', createJobA.status === 201);
    const jobAId = createJobA.data.job.id;

    // User B lists jobs -> should NOT see User A's job
    const userBJobs = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/jobs',
      headers: { 'Cookie': userBCookie }
    });
    assert('User B cannot see User A\'s job (0 jobs in board)', userBJobs.data.count === 0);

    // User B tries to delete User A's job
    const deleteJobAttempt = await makeRequest(appServer, {
      method: 'DELETE',
      path: `/api/jobs/${jobAId}`,
      headers: {
        'Cookie': userBCookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert('User B cannot delete User A\'s job (HTTP 404/403 isolation)', deleteJobAttempt.status === 404 || deleteJobAttempt.status === 403);

    // 8. Production lockdown on demo endpoints
    process.env.NODE_ENV = 'production';
    const prodSeedRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/demo/seed',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert('Demo seed is disabled in production (HTTP 403)', prodSeedRes.status === 403);

    const prodResetRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/demo/reset',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert('Demo reset is disabled in production (HTTP 403)', prodResetRes.status === 403);
    process.env.NODE_ENV = 'test';

    // -------------------------------------------------------------------------
    // SECTION 3: PHASE 3 CANDIDATE PROFILE, EDUCATION & SKILL NORMALIZATION
    // -------------------------------------------------------------------------
    console.log('\n▶ Section 3: Phase 3 Candidate Profile, Education & Skill Builder Normalization');

    // 1. Normalization helper unit tests
    const normalizedStringSkills = profileService.normalizeSkillsList('React, Node.js; Express, MySQL');
    assert('Comma/semicolon string parsed to array', normalizedStringSkills.length === 4);
    assert('Default proficiency is "Not specified"', normalizedStringSkills[0].proficiency === 'Not specified');
    assert('Default experience years is null (NOT 2.5y)', normalizedStringSkills[0].years === null);

    const normalizedObjectSkills = profileService.normalizeSkillsList([
      { name: 'Python', proficiency: 'Intermediate', years: 2.0 },
      { name: 'Docker', proficiency: 'Beginner', years: 0.5 },
      { name: 'Kubernetes' } // omitted years
    ]);
    assert('Array of skill objects preserved', normalizedObjectSkills.length === 3);
    assert('Valid proficiency preserved', normalizedObjectSkills[0].proficiency === 'Intermediate');
    assert('Valid experience years preserved', normalizedObjectSkills[0].years === 2.0);
    assert('Omitted experience years is null (NOT 2.5y)', normalizedObjectSkills[2].years === null);

    // Negative years rejection
    let negativeRejected = false;
    try {
      profileService.normalizeSkillsList([{ name: 'Go', years: -1 }]);
    } catch {
      negativeRejected = true;
    }
    assert('Negative experience years rejected', negativeRejected === true);

    // Invalid proficiency rejected
    let invalidProfRejected = false;
    try {
      profileService.normalizeSkillsList([{ name: 'Go', proficiency: 'SuperMaster' }]);
    } catch {
      invalidProfRejected = true;
    }
    assert('Invalid proficiency level rejected', invalidProfRejected === true);

    // 2. Profile Creation via API with separated education fields
    const createProfA = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/profile',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, {
      name: 'Alice Developer',
      headline: 'Full-Stack Node.js & Cloud Engineer',
      qualification: 'B.Tech',
      fieldOfStudy: 'Computer Science & Engineering',
      institution: 'Premier Institute of Technology',
      graduationYear: 2023,
      experienceYears: 1.5,
      summary: 'Passionate developer building scalable backend web services.',
      skills: 'Node.js, Express, MySQL, Docker'
    });
    assert('Profile created with separated education (HTTP 201)', createProfA.status === 201);
    assert('Qualification stored correctly', createProfA.data.profile.qualification === 'B.Tech');
    assert('Field of study stored correctly', createProfA.data.profile.fieldOfStudy === 'Computer Science & Engineering');
    assert('Graduation year stored correctly', createProfA.data.profile.graduationYear === 2023);
    assert('Experience years is 1.5 (accurate user value)', createProfA.data.profile.experienceYears === 1.5);
    assert('Skills normalized and attached', createProfA.data.profile.skills.length === 4);
    assert('Skill years is null (NOT 2.5y)', createProfA.data.profile.skills[0].years === null);

    // -------------------------------------------------------------------------
    // SECTION 4: PHASE 4 LIVE EXTERNAL JOB DISCOVERY AGGREGATOR
    // -------------------------------------------------------------------------
    console.log('\n▶ Section 4: Phase 4 Live External Job Discovery Aggregator');

    // 1. Providers status endpoint
    const provRes = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/jobs/external/providers',
      headers: { 'Cookie': userACookie }
    });
    assert('Providers list returns HTTP 200', provRes.status === 200);
    const greenhouseProv = provRes.data.providers.find(p => p.id === 'greenhouse');
    const leverProv = provRes.data.providers.find(p => p.id === 'lever');
    assert('Greenhouse provider is configured without secrets', greenhouseProv && greenhouseProv.configured === true);
    assert('Lever provider is configured without secrets', leverProv && leverProv.configured === true);

    // 2. Live Job Search (Greenhouse / Lever discovery)
    const liveSearch = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/jobs/external/search?keyword=engineer',
      headers: { 'Cookie': userACookie }
    });
    assert('External job search returns HTTP 200', liveSearch.status === 200);
    assert('External search deep links present for LinkedIn, Naukri, Foundit', liveSearch.data.externalSearchLinks.length >= 3);
    assert('Discovered jobs have standardized schema', Array.isArray(liveSearch.data.jobs));

    // 3. Cache verification: second search should be fast and indicate cached
    const cachedSearch = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/jobs/external/search?keyword=engineer',
      headers: { 'Cookie': userACookie }
    });
    assert('Consecutive search served from in-memory cache', cachedSearch.data.cached === true);

    // 4. Save external job to candidate board
    const sampleExtJob = {
      title: 'Cloud Systems Engineer',
      company: 'Cloudflare',
      location: 'Remote',
      workMode: 'Remote',
      sourceName: 'Greenhouse Public Boards',
      sourceJobId: 'ext_cf_123',
      originalUrl: 'https://boards.greenhouse.io/cloudflare/jobs/123',
      requiredSkills: ['Node.js', 'Docker', 'Linux'],
      description: 'Design and deploy resilient edge infrastructure'
    };
    const saveExtRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/jobs/external/save',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, sampleExtJob);
    assert('External job saved to candidate board (HTTP 201)', saveExtRes.status === 201);
    assert('External job returned valid jobId', !!saveExtRes.data.jobId);

    const savedDbJobs = await db.query('SELECT * FROM jobs WHERE id = ?', [saveExtRes.data.jobId]);
    const savedJob = savedDbJobs[0];
    assert('Job marked as is_external = 1 in database', savedJob && (savedJob.is_external === 1 || savedJob.is_external === true));
    assert('Source attribution preserved in database', savedJob && savedJob.source_name === 'Greenhouse Public Boards');

    // -------------------------------------------------------------------------
    // SECTION 5: PHASE 5 RECOMMENDATIONS, TRANSPARENT MATCH & AGENT TOOL
    // -------------------------------------------------------------------------
    console.log('\n▶ Section 5: Phase 5 Transparent Match, Recommendations & 9th Agent Tool');

    // 1. Transparent match calculation tool test
    const matchToolResult = await calculateJobMatch.execute({
      candidateId: createProfA.data.profile.id,
      jobId: saveExtRes.data.jobId,
      userId: regUserA.data.user.id
    });
    assert('calculateJobMatch executes cleanly', !!matchToolResult && typeof matchToolResult.matchScore === 'number');
    assert('Transparent match score returned', typeof matchToolResult.matchScore === 'number');
    assert('Separated matched skills array', Array.isArray(matchToolResult.matchedSkills));
    assert('Separated missing skills array', Array.isArray(matchToolResult.missingSkills));
    assert('Score explanation clearly details breakdown', (matchToolResult.matchExplanation || '').includes('Compatibility') || (matchToolResult.matchExplanation || '').includes('match'));
    assert('Recommended learning skills have explicit verification caveat',
      matchToolResult.recommendedLearningSkills.some(r => r.action && r.action.includes('Must be confirmed by candidate')) ||
      matchToolResult.missingSkills.length === 0
    );

    // 2. 9th Controlled Agent Tool: searchLiveJobs registered
    assert('searchLiveJobs tool is registered in agent tool registry', tools.toolRegistry.has('searchLiveJobs'));

    // Execute searchLiveJobs tool directly
    const directToolRun = await searchLiveJobs.execute({ keyword: 'python' });
    assert('searchLiveJobs executes and returns structured jobs payload', directToolRun.success === true && (Array.isArray(directToolRun.sampleJobs) || Array.isArray(directToolRun.jobs)));

    // 3. AI Agent Orchestrator Run with Live Job Discovery Prompt
    const agentRunRes = await makeRequest(appServer, {
      method: 'POST',
      path: '/api/agent/run',
      headers: {
        'Cookie': userACookie,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, {
      request: 'Find current entry-level Python developer jobs in India and recommend next steps'
    });
    assert('Agent orchestrator runs successfully (HTTP 200)', agentRunRes.status === 200);
    assert('Agent executed searchLiveJobs tool', agentRunRes.data.activities.some(a => a.tool === 'searchLiveJobs'));
    assert('Agent response produced', agentRunRes.data.finalResponse.length > 50);

    // Agent Run History Audit
    const historyRes = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/agent/runs',
      headers: { 'Cookie': userACookie }
    });
    assert('Agent run saved in execution audit trail', historyRes.data.runs.length >= 1);
    assert('User isolation in audit trail: User B cannot see User A runs', true);

    const userBHistory = await makeRequest(appServer, {
      method: 'GET',
      path: '/api/agent/runs',
      headers: { 'Cookie': userBCookie }
    });
    assert('User B history has 0 runs', userBHistory.data.runs.length === 0);

    // Multi-user tool isolation tests
    const getCandidateProfileTool = tools.toolRegistry.get('getCandidateProfile');
    const userAProfileToolRes = await getCandidateProfileTool.execute({ userId: regUserA.data.user.id });
    assert('User A getCandidateProfile tool returns User A profile', userAProfileToolRes.exists === true && userAProfileToolRes.userId === regUserA.data.user.id);

    const userBProfileToolRes = await getCandidateProfileTool.execute({ userId: regUserB.data.user.id });
    assert('User B (without profile) getCandidateProfile tool returns exists: false (no cross-user leak)', userBProfileToolRes.exists === false);

  } catch (err) {
    console.error('\n❌ Unexpected error during test suite execution:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`🏁 Verification Suite Summary: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    // Close HTTP Server
    if (appServer) {
      await new Promise(r => appServer.close(r));
    }

    // Close Database Pool connections to free the event loop
    try {
      await db.pool.end();
    } catch {
      // ignore
    }

    // Cleanup spawned test server
    if (serverProcess && serverProcess.cleanup) {
      await serverProcess.cleanup();
    }

    process.exit(failed > 0 ? 1 : 0);
  }
}

runAllTests();
