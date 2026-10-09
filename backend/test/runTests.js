/**
 * Automated Verification & Test Suite
 * Tests REST endpoints, database queries, tool execution, and the AI agent loop.
 * Updated to use isolated disposable MySQL (port 3307) and verified authenticated workflow.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execSync } = require('child_process');
const mysql = require('mysql2/promise');

const TEST_PORT = 3307;
const TEST_DB = 'careerpilot_runtests_db';
const MYSQLD_PATH = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';

process.env.DB_PORT = String(TEST_PORT);
process.env.DB_NAME = TEST_DB;
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_HOST = '127.0.0.1';
process.env.JWT_SECRET = 'careerpilot_runtests_verification_secret_key_32chars!';
process.env.NODE_ENV = 'test';

const { runMigrations } = require('../../database/migrate');
const db = require('../config/db');

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
    throw new Error(`MySQL daemon not found at ${MYSQLD_PATH}`);
  }

  const tempDatadir = path.join(os.tmpdir(), `mysql_disposable_runtests_${Date.now()}`);
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
    } catch {}
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
      } catch {}
    }
  };
}

let appServer = null;
let sessionCookie = '';

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

async function runFetch(urlPath, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
    ...options.headers
  };
  let body = null;
  if (options.body) {
    body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
  }

  const res = await makeRequest(appServer, { method, path: urlPath, headers }, body);

  if (res.headers && res.headers['set-cookie']) {
    sessionCookie = res.headers['set-cookie'][0].split(';')[0];
  }

  return { status: res.status, data: res.data };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting CareerPilot Automated Verification Suite');
  console.log('📡 Isolated Disposable Database: port 3307');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${detail}`);
      failed++;
    }
  }

  let serverObj = null;

  try {
    // 1. Disposable Server Setup
    serverObj = await ensureDisposableServer();

    // 2. Setup isolated schema & run migrations
    const rootConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: ''
    });
    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootConn.query(`CREATE DATABASE \`${TEST_DB}\``);

    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await rootConn.query(`USE \`${TEST_DB}\``);
      await rootConn.query(stmt);
    }
    await rootConn.end();

    await runMigrations(db.pool);

    // 3. Start ephemeral application server
    const app = require('../server');
    appServer = http.createServer(app);
    await new Promise(resolve => appServer.listen(0, '127.0.0.1', resolve));
    console.log(`📡 Ephemeral test server live on port ${appServer.address().port}\n`);

    // Test 1: Healthcheck
    console.log('▶ 1. Healthcheck & Database Connection');
    const health = await runFetch('/api/health');
    assert('Server is online', health.status === 200);
    assert('Database is connected', health.data.databaseConnected === true);

    // Register test candidate user
    const regRes = await runFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        name: 'Jordan Smith',
        email: 'jordan.smith@example.com',
        password: 'JordanPassword123!'
      })
    });
    assert('Test user registered and authenticated', regRes.status === 201, JSON.stringify(regRes.data));
    assert('Session cookie received', !!sessionCookie);

    // Test 2: Clean Empty State Check
    console.log('\n▶ 2. Fresh Empty State Verification');
    const emptyProfile = await runFetch('/api/profile');
    assert('Profile is null in clean state', emptyProfile.data.profile === null);

    const emptyJobs = await runFetch('/api/jobs');
    assert('Zero jobs in clean state', emptyJobs.data.count === 0);

    const emptyStats = await runFetch('/api/stats');
    assert('Stats reflect zero jobs', emptyStats.data.stats.totalSavedJobs === 0);

    // Test 3: Agent Onboarding guidance on empty profile
    console.log('\n▶ 3. Agent Execution on Empty Profile');
    const agentEmpty = await runFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ request: 'Which of my saved jobs is the best match?' })
    });
    assert('Agent handles empty state without crashing', agentEmpty.status === 200);
    assert('Agent advises candidate to create profile', agentEmpty.data.finalResponse.includes('profile'));

    // Test 4: Candidate Profile Creation (Onboarding)
    console.log('\n▶ 4. Candidate Profile Creation');
    const createProfRes = await runFetch('/api/profile', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        name: 'Jordan Smith',
        headline: 'Full-Stack Software Engineer | Node.js & MySQL',
        qualification: 'B.S.',
        fieldOfStudy: 'Computer Science',
        institution: 'State University',
        graduationYear: 2022,
        experienceYears: 3.5,
        summary: 'Experienced web engineer building REST APIs and relational databases.',
        skills: [
          { name: 'JavaScript', proficiency: 'Expert', years: 3.5 },
          { name: 'Node.js', proficiency: 'Expert', years: 3.5 },
          { name: 'Express.js', proficiency: 'Advanced', years: 3.0 },
          { name: 'MySQL', proficiency: 'Advanced', years: 3.0 },
          { name: 'REST APIs', proficiency: 'Expert', years: 3.5 },
          { name: 'Git', proficiency: 'Advanced', years: 3.5 }
        ]
      })
    });
    assert('Profile created with HTTP 201', createProfRes.status === 201);
    assert('Profile ID returned', !!createProfRes.data.profile.id);
    assert('Skills cataloged correctly', createProfRes.data.profile.skills.length >= 6);

    // Test 5: Job Creation
    console.log('\n▶ 5. Job Creation & Retrieval');
    const createJobRes = await runFetch('/api/jobs', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        title: 'Backend Systems Engineer',
        company: 'Apex Cloud Systems',
        location: 'Remote',
        workMode: 'Remote',
        salaryRange: '$120,000 - $140,000',
        description: 'Building high-performance Express REST services and optimizing MySQL queries.',
        requiredSkills: ['Node.js', 'Express.js', 'MySQL', 'REST APIs', 'Git'],
        experienceRequired: '2-4 years'
      })
    });
    assert('Job created with HTTP 201', createJobRes.status === 201);
    const createdJobId = createJobRes.data.job.id;
    assert('Job ID generated', !!createdJobId);

    // Test 6: Direct Job Compatibility Analysis
    console.log('\n▶ 6. Direct Job Compatibility Analysis');
    const analyzeRes = await runFetch(`/api/jobs/${createdJobId}/analyze`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ candidateId: createProfRes.data.profile.id })
    });
    assert('Analysis successful', analyzeRes.status === 200);
    assert('Match score computed (> 70%)', analyzeRes.data.analysis.matchScore >= 70);
    assert('Matched skills identified', analyzeRes.data.analysis.matchedSkills.length > 0);

    // Test 7: Autonomous Agent Loop Execution (Multiple Tool Calls)
    console.log('\n▶ 7. Autonomous Agent Loop Execution');
    const agentRunRes = await runFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        request: 'Analyze my saved jobs, calculate the match score, and prepare interview questions for the best match.',
        candidateId: createProfRes.data.profile.id
      })
    });
    assert('Agent completed workflow', agentRunRes.status === 200 && agentRunRes.data.status === 'completed');
    assert('Multiple iterations logged', agentRunRes.data.totalIterations >= 2);
    assert('Activity steps recorded', agentRunRes.data.activities.length >= 3);
    assert('Final response synthesized', agentRunRes.data.finalResponse.length > 50);

    // Test 8: Agent Audit Log Persistence
    console.log('\n▶ 8. Agent Audit Log & Tool Call Persistence');
    const runId = agentRunRes.data.runId;
    const runDetail = await runFetch(`/api/agent/runs/${runId}`);
    assert('Run retrieved from MySQL', runDetail.status === 200 && runDetail.data.run.id === runId);
    assert('Granular tool calls recorded in agent_tool_calls', runDetail.data.run.toolCalls.length > 0);

    // Test 9: Error Handling
    console.log('\n▶ 9. Error Handling Verification');
    const emptyPromptRes = await runFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ request: '   ' })
    });
    assert('Empty request rejected with 400', emptyPromptRes.status === 400);

    const invalidJobRes = await runFetch('/api/jobs/999999');
    assert('Invalid Job ID rejected with 404', invalidJobRes.status === 404);

    // Summary
    console.log('\n====================================================');
    console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    if (appServer) {
      await new Promise(r => appServer.close(r));
    }
    try {
      await db.pool.end();
    } catch {}
    if (serverObj && serverObj.cleanup) {
      await serverObj.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runTestSuite();
}

module.exports = { runTestSuite };
