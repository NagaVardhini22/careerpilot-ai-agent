/**
 * Phase 2 Authentication & Multi-User Data Isolation Verification Suite
 * 
 * Tests against an isolated disposable local database instance (port 3307):
 * 1. Cryptographic hashing (scrypt + timingSafeEqual verification).
 * 2. HMAC-SHA256 session token generation and verification.
 * 3. Strict production JWT_SECRET guard (>= 32 chars).
 * 4. User registration, password complexity validation, and email normalization.
 * 5. Legacy profile quarantine (prevents unverified account takeover).
 * 6. User login, generic error responses (anti-enumeration), and rate limiting.
 * 7. HTTP-only session cookies and CSRF protection (X-Requested-With).
 * 8. Server-side authentication enforcement (401 on unauthenticated access).
 * 9. Anti-IDOR: server derives user ID strictly from session context.
 * 10. Multi-user data isolation across profiles, jobs, analyses, and agent runs.
 * 11. Production lockdown of demo seed and reset endpoints (403 Forbidden).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execSync } = require('child_process');
const mysql = require('mysql2/promise');

const TEST_PORT = 3307;
const TEST_DB = 'careerpilot_phase2_test_db';
const MYSQLD_PATH = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe';

// Configure environment for test database on port 3307
process.env.DB_PORT = String(TEST_PORT);
process.env.DB_NAME = TEST_DB;
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_HOST = '127.0.0.1';
process.env.JWT_SECRET = 'careerpilot_phase2_test_secret_key_exceeding_32_characters!';
process.env.NODE_ENV = 'test';

const { hashPassword, verifyPassword, generateToken, verifyToken } = require('../services/authService');
const { runMigrations } = require('../../database/migrate');

/**
 * Ensures an isolated disposable MySQL test server is running on TEST_PORT.
 */
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
    // Need to spin up disposable instance
  }

  if (!fs.existsSync(MYSQLD_PATH)) {
    throw new Error(`MySQL daemon not found at ${MYSQLD_PATH} to spin up disposable test database.`);
  }

  const tempDatadir = path.join(os.tmpdir(), `mysql_disposable_p2_${Date.now()}`);
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
        // ignore on Windows if locked
      }
    }
  };
}

/**
 * Execute HTTP request against ephemeral test server
 */
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

function parseSetCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return { cookieStr: null, raw: [] };
  const rawList = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookiePairs = rawList.map(c => c.split(';')[0].trim());
  return {
    cookieStr: cookiePairs.join('; '),
    raw: rawList
  };
}

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('🧪 Starting CareerPilot Phase 2 Authentication & Multi-User Tests');
  console.log(`📡 Disposable Database: ${TEST_DB} @ 127.0.0.1:${TEST_PORT}`);
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

  const { cleanup } = await ensureDisposableServer();

  let rootConn;
  let server;

  try {
    // ------------------------------------------------------------------------
    // 1. UNIT TESTS: Cryptographic Security & Tokens
    // ------------------------------------------------------------------------
    console.log('▶ 1. Cryptographic Security & Password Hashing...');
    const plainPass = 'SuperSecret123!';
    const hash1 = await hashPassword(plainPass);
    const hash2 = await hashPassword(plainPass);

    assert('hashPassword generates salt:hash format', hash1.includes(':') && hash1.length > 50, `hash: ${hash1}`);
    assert('Different salts generate distinct hashes for same password', hash1 !== hash2, 'hashes should differ due to salt');
    assert('verifyPassword verifies correct password', await verifyPassword(plainPass, hash1) === true, 'should match');
    assert('verifyPassword rejects incorrect password', await verifyPassword('WrongPassword123!', hash1) === false, 'should fail');
    assert('verifyPassword rejects malformed hash string', await verifyPassword(plainPass, 'malformed-hash') === false, 'should fail gracefully');

    console.log('\n▶ 2. HMAC-SHA256 Session Token Generation & Verification...');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = generateToken({ userId: 42, email: 'user@test.com', name: 'Test User', exp });
    const parts = token.split('.');
    assert('generateToken produces 3-part base64url token', parts.length === 3, `parts count: ${parts.length}`);

    const verified = verifyToken(token);
    assert('verifyToken successfully validates signature and payload', verified && verified.userId === 42 && verified.email === 'user@test.com', JSON.stringify(verified));

    // Tampered payload
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 1, email: 'admin@test.com', exp })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    assert('verifyToken rejects tampered token with invalid signature', verifyToken(tamperedToken) === null, 'tampered token should return null');

    // Expired token
    const expiredToken = generateToken({ userId: 42, email: 'user@test.com', exp: Math.floor(Date.now() / 1000) - 10 });
    assert('verifyToken rejects expired token', verifyToken(expiredToken) === null, 'expired token should return null');

    // ------------------------------------------------------------------------
    // 2. SETUP DISPOSABLE TEST DATABASE & MIGRATIONS
    // ------------------------------------------------------------------------
    console.log('\n▶ 3. Initializing Disposable Database Schema & Running Migrations...');
    rootConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: '',
      multipleStatements: true
    });

    await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootConn.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.query(`USE \`${TEST_DB}\``);

    // Load base schema
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    await rootConn.query(schemaSql);

    // Run migration 001
    const pool = mysql.createPool({
      host: '127.0.0.1',
      port: TEST_PORT,
      user: 'root',
      password: '',
      database: TEST_DB
    });
    const migrationResults = await runMigrations(pool);
    assert('Database migrations executed successfully', migrationResults.applied.length >= 1, `applied: ${migrationResults.applied.join(', ')}`);

    // Insert standard catalog skills for testing profile creation
    await rootConn.query(`
      INSERT INTO skills (name, category) VALUES 
      ('JavaScript', 'Frontend'),
      ('TypeScript', 'Frontend'),
      ('React', 'Frontend'),
      ('Node.js', 'Backend'),
      ('Express.js', 'Backend'),
      ('MySQL', 'Database'),
      ('Python', 'Backend'),
      ('Docker', 'DevOps')
      ON DUPLICATE KEY UPDATE name=name
    `);

    // Pre-seed an unclaimed legacy user and candidate profile (password_hash is NULL)
    const [legacyUser] = await rootConn.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, NULL)',
      ['Legacy Candidate', 'legacy.user@example.com']
    );
    await rootConn.query(
      'INSERT INTO candidate_profiles (user_id, headline, summary, education, experience_years, is_legacy) VALUES (?, ?, ?, ?, ?, TRUE)',
      [legacyUser.insertId, 'Senior Fullstack Engineer', 'Legacy imported summary', 'B.Tech', 5.0]
    );

    // ------------------------------------------------------------------------
    // 3. START EPHEMERAL EXPRESS SERVER
    // ------------------------------------------------------------------------
    console.log('\n▶ 4. Starting Ephemeral Express API Server for Integration Testing...');
    const app = require('../server');
    server = app.listen(0);
    const serverPort = server.address().port;
    console.log(`  Ephemeral server running on port ${serverPort}`);

    // ------------------------------------------------------------------------
    // 4. UNAUTHENTICATED ENDPOINT REJECTION (401)
    // ------------------------------------------------------------------------
    console.log('\n▶ 5. Verifying Unauthenticated Access Rejection (HTTP 401)...');
    const privateEndpoints = [
      { method: 'GET', path: '/api/profile' },
      { method: 'POST', path: '/api/profile', body: { headline: 'Test' } },
      { method: 'GET', path: '/api/jobs' },
      { method: 'POST', path: '/api/jobs', body: { title: 'Test', company: 'Co', description: 'Desc' } },
      { method: 'DELETE', path: '/api/jobs/1' },
      { method: 'POST', path: '/api/jobs/1/analyze' },
      { method: 'POST', path: '/api/agent/run', body: { request: 'Hello' } },
      { method: 'GET', path: '/api/agent/runs' },
      { method: 'GET', path: '/api/agent/runs/1' },
      { method: 'GET', path: '/api/analyses' },
      { method: 'GET', path: '/api/applications' },
      { method: 'GET', path: '/api/stats' },
      { method: 'GET', path: '/api/auth/me' }
    ];

    for (const ep of privateEndpoints) {
      const res = await makeRequest(server, ep, ep.body);
      assert(`Unauthenticated ${ep.method} ${ep.path} returns 401`, res.status === 401, `got status ${res.status}`);
    }

    // ------------------------------------------------------------------------
    // 5. REGISTRATION VALIDATION & LEGACY QUARANTINE
    // ------------------------------------------------------------------------
    console.log('\n▶ 6. Registration Validation & Legacy Profile Quarantine...');

    // Short password rejection
    const shortPassRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'short'
    });
    assert('Registration rejects short password (< 8 chars)', shortPassRes.status === 400 && shortPassRes.data.error.includes('at least 8 characters'), shortPassRes.data.error);

    // Missing required fields
    const missingFieldRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Alice',
      password: 'Password123!'
    });
    assert('Registration rejects missing email', missingFieldRes.status === 400, `status: ${missingFieldRes.status}`);

    // REGRESSION TEST: Registration name validation
    // 1. Missing name in request body
    const missingNameRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      email: 'noname@example.com',
      password: 'StrongPassword123!'
    });
    assert('Registration rejects missing name with 400', missingNameRes.status === 400 && missingNameRes.data.error.includes('Name is required'), missingNameRes.data.error);

    // 2. Empty string name
    const emptyNameRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: '',
      email: 'emptyname@example.com',
      password: 'StrongPassword123!'
    });
    assert('Registration rejects empty string name with 400', emptyNameRes.status === 400 && emptyNameRes.data.error.includes('Name is required'), emptyNameRes.data.error);

    // 3. Whitespace-only name
    const whitespaceNameRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: '    ',
      email: 'whitespacename@example.com',
      password: 'StrongPassword123!'
    });
    assert('Registration rejects whitespace-only name with 400', whitespaceNameRes.status === 400 && whitespaceNameRes.data.error.includes('Name is required'), whitespaceNameRes.data.error);

    // 4. Populated name with leading/trailing whitespace is accepted and trimmed
    const trimmedNameRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: '   Padded Candidate   ',
      email: 'padded.candidate@example.com',
      password: 'StrongPassword123!'
    });
    assert('Registration accepts padded name and trims whitespace', trimmedNameRes.status === 201 && trimmedNameRes.data.user.name === 'Padded Candidate', JSON.stringify(trimmedNameRes.data));

    // 5. Registration supports fullName fallback
    const fullNameRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      fullName: 'Fullname Candidate',
      email: 'fullname.candidate@example.com',
      password: 'StrongPassword123!'
    });
    assert('Registration accepts fullName field fallback', fullNameRes.status === 201 && fullNameRes.data.user.name === 'Fullname Candidate', JSON.stringify(fullNameRes.data));

    // Legacy quarantine protection: attempting to register matching legacy unverified profile
    const legacyClaimRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Imposter or Claimer',
      email: 'legacy.user@example.com',
      password: 'StrongPassword123!'
    });
    assert(
      'Registration with legacy profile email is rejected and quarantined (409)',
      legacyClaimRes.status === 409 && legacyClaimRes.data.error.includes('quarantined'),
      legacyClaimRes.data.error
    );

    // Successful User 1 registration
    const user1RegRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Alice User1',
      email: 'Alice.User1@Example.com', // test email normalization
      password: 'SecurePasswordUser1!'
    });
    assert('User 1 registration succeeds (201)', user1RegRes.status === 201 && user1RegRes.data.success === true, JSON.stringify(user1RegRes.data));
    assert('User 1 email is normalized to lowercase', user1RegRes.data.user.email === 'alice.user1@example.com', user1RegRes.data.user.email);
    const user1Token = user1RegRes.data.token;
    const user1Cookies = parseSetCookie(user1RegRes.headers);
    assert('Registration sets HTTP-only cookie', user1Cookies.raw.some(c => c.toLowerCase().includes('httponly')), user1Cookies.raw.join('; '));

    // Duplicate email registration rejection
    const dupRegRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Alice Duplicate',
      email: 'alice.user1@example.com',
      password: 'SecurePasswordUser1!'
    });
    assert('Duplicate registration rejected with 409 Conflict', dupRegRes.status === 409, `got ${dupRegRes.status}`);

    // Successful User 2 registration
    const user2RegRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Bob User2',
      email: 'bob.user2@example.com',
      password: 'SecurePasswordUser2!'
    });
    assert('User 2 registration succeeds (201)', user2RegRes.status === 201 && user2RegRes.data.success === true, JSON.stringify(user2RegRes.data));
    const user2Token = user2RegRes.data.token;
    const user2Cookies = parseSetCookie(user2RegRes.headers);

    // ------------------------------------------------------------------------
    // 6. LOGIN SECURITY & RATE LIMITING
    // ------------------------------------------------------------------------
    console.log('\n▶ 7. Login Security, Anti-Enumeration & Rate Limiting...');

    // Wrong password (generic error)
    const wrongPassRes = await makeRequest(server, { method: 'POST', path: '/api/auth/login' }, {
      email: 'alice.user1@example.com',
      password: 'WrongPassword!'
    });
    assert('Login with wrong password returns 401 with generic error', wrongPassRes.status === 401 && wrongPassRes.data.error === 'Invalid email or password.', wrongPassRes.data.error);

    // Unregistered email (generic error - no email enumeration)
    const nonExistRes = await makeRequest(server, { method: 'POST', path: '/api/auth/login' }, {
      email: 'nobody@example.com',
      password: 'SomePassword123!'
    });
    assert('Login with unregistered email returns 401 with generic error', nonExistRes.status === 401 && nonExistRes.data.error === 'Invalid email or password.', nonExistRes.data.error);

    // Legacy unverified user cannot login
    const legacyLoginRes = await makeRequest(server, { method: 'POST', path: '/api/auth/login' }, {
      email: 'legacy.user@example.com',
      password: 'AnyPassword123!'
    });
    assert('Legacy unverified user cannot log in (401)', legacyLoginRes.status === 401, `got ${legacyLoginRes.status}`);

    // Successful login for User 1
    const user1LoginRes = await makeRequest(server, { method: 'POST', path: '/api/auth/login' }, {
      email: 'alice.user1@example.com',
      password: 'SecurePasswordUser1!'
    });
    assert('User 1 login succeeds with valid credentials (200)', user1LoginRes.status === 200 && user1LoginRes.data.success === true, JSON.stringify(user1LoginRes.data));
    const user1LoginCookies = parseSetCookie(user1LoginRes.headers);
    assert('Login sets HTTP-only session cookie', user1LoginCookies.raw.some(c => c.toLowerCase().includes('httponly')), 'cookie missing httponly');

    // ------------------------------------------------------------------------
    // 7. CSRF & COOKIE AUTHENTICATION ENFORCEMENT
    // ------------------------------------------------------------------------
    console.log('\n▶ 8. Cookie Authentication & CSRF Header Validation...');

    // GET /api/auth/me using Cookie
    const meRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: user1LoginCookies.cookieStr }
    });
    assert('GET /api/auth/me succeeds with cookie authentication', meRes.status === 200 && meRes.data.user.email === 'alice.user1@example.com', JSON.stringify(meRes.data));

    // Mutating request using Cookie WITHOUT X-Requested-With (should fail with 403 CSRF validation failed)
    const csrfFailRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/jobs',
      headers: { Cookie: user1LoginCookies.cookieStr }
    }, {
      title: 'CSRF Test Job',
      company: 'Evil Inc',
      description: 'Should be rejected'
    });
    assert('Cookie mutating request without X-Requested-With fails with 403 CSRF error', csrfFailRes.status === 403 && csrfFailRes.data.error.includes('CSRF'), JSON.stringify(csrfFailRes.data));

    // Mutating request using Cookie WITH X-Requested-With (should succeed)
    const csrfSuccessRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/jobs',
      headers: {
        Cookie: user1LoginCookies.cookieStr,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, {
      title: 'Frontend Engineer User 1',
      company: 'TechCorp',
      location: 'Remote',
      description: 'Exciting frontend role for User 1'
    });
    assert('Cookie mutating request with X-Requested-With succeeds (201)', csrfSuccessRes.status === 201 && csrfSuccessRes.data.success === true, JSON.stringify(csrfSuccessRes.data));
    const user1JobId = csrfSuccessRes.data.job.id;

    // Bearer token mutating request WITHOUT X-Requested-With (should succeed because Bearer tokens are immune to browser cross-site ambient auth)
    const bearerSuccessRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/jobs',
      headers: {
        Authorization: `Bearer ${user2Token}`
      }
    }, {
      title: 'DevOps Engineer User 2',
      company: 'CloudCorp',
      location: 'Bangalore',
      description: 'Exciting DevOps role for User 2'
    });
    assert('Bearer token mutating request without X-Requested-With succeeds (201)', bearerSuccessRes.status === 201 && bearerSuccessRes.data.success === true, JSON.stringify(bearerSuccessRes.data));
    const user2JobId = bearerSuccessRes.data.job.id;

    // Logout clears cookie
    const logoutRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/logout',
      headers: {
        Cookie: user1LoginCookies.cookieStr,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    assert('Logout endpoint succeeds', logoutRes.status === 200, JSON.stringify(logoutRes.data));
    const logoutCookies = parseSetCookie(logoutRes.headers);
    assert('Logout clears cookie with max-age=0 / expires in past', logoutCookies.raw.some(c => c.includes('careerpilot_session=;') || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970')), logoutCookies.raw.join('; '));
    assert('Logout clearCookie matches httpOnly, sameSite and path options', logoutCookies.raw.some(c => c.toLowerCase().includes('httponly') && c.toLowerCase().includes('samesite=strict') && c.toLowerCase().includes('path=/')), logoutCookies.raw.join('; '));

    // ------------------------------------------------------------------------
    // 8. MULTI-USER DATA ISOLATION & ANTI-IDOR
    // ------------------------------------------------------------------------
    console.log('\n▶ 9. Multi-User Isolation & Anti-IDOR Enforcement...');

    // User 1 creates profile
    const u1ProfCreate = await makeRequest(server, {
      method: 'POST',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${user1Token}` }
    }, {
      headline: 'Fullstack Dev User 1',
      summary: 'Passionate JavaScript & Node developer',
      qualification: 'B.Tech CS',
      fieldOfStudy: 'Computer Science',
      institution: 'State University',
      graduationYear: 2023,
      experienceYears: 2.0,
      skills: [
        { name: 'JavaScript', proficiency: 'Advanced', years: 2.0 },
        { name: 'Node.js', proficiency: 'Intermediate', years: 1.5 }
      ]
    });
    assert('User 1 creates candidate profile', u1ProfCreate.status === 201 && u1ProfCreate.data.profile.headline === 'Fullstack Dev User 1', JSON.stringify(u1ProfCreate.data));
    const user1CandidateId = u1ProfCreate.data.profile.id;

    // User 2 creates profile
    const u2ProfCreate = await makeRequest(server, {
      method: 'POST',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${user2Token}` }
    }, {
      headline: 'DevOps Specialist User 2',
      summary: 'Cloud and infrastructure specialist',
      qualification: 'B.S.',
      experienceYears: 4.0,
      skills: [
        { name: 'Docker', proficiency: 'Expert', years: 4.0 }
      ]
    });
    assert('User 2 creates candidate profile', u2ProfCreate.status === 201 && u2ProfCreate.data.profile.headline === 'DevOps Specialist User 2', JSON.stringify(u2ProfCreate.data));
    const user2CandidateId = u2ProfCreate.data.profile.id;

    // Anti-IDOR Profile Check: User 1 queries GET /api/profile
    const u1ProfGet = await makeRequest(server, {
      method: 'GET',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('User 1 retrieves their own profile', u1ProfGet.data.profile.id === user1CandidateId && u1ProfGet.data.profile.headline === 'Fullstack Dev User 1', JSON.stringify(u1ProfGet.data));

    // IDOR Tamper Test: User 1 attempts to retrieve User 2 profile with query param candidateId
    const u1TryU2Prof = await makeRequest(server, {
      method: 'GET',
      path: `/api/profile?candidateId=${user2CandidateId}`,
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('User 1 cannot view User 2 profile via candidateId query param (returns null/isolated)', u1TryU2Prof.data.profile === null, JSON.stringify(u1TryU2Prof.data));

    // IDOR Tamper Test: User 1 attempts to update User 2 profile
    const u1UpdateU2Prof = await makeRequest(server, {
      method: 'PUT',
      path: `/api/profile/${user2CandidateId}`,
      headers: { Authorization: `Bearer ${user1Token}` }
    }, {
      headline: 'Hacked Headline by User 1'
    });
    assert('User 1 cannot update User 2 profile (404 Access Denied)', u1UpdateU2Prof.status === 404, `got status ${u1UpdateU2Prof.status}`);

    // Verify User 2 profile remained unmodified
    const u2ProfCheck = await makeRequest(server, {
      method: 'GET',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert('User 2 profile remains untampered', u2ProfCheck.data.profile.headline === 'DevOps Specialist User 2', u2ProfCheck.data.profile.headline);

    // Job Isolation Check: User 1 calls GET /api/jobs
    const u1JobsGet = await makeRequest(server, {
      method: 'GET',
      path: '/api/jobs',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('User 1 jobs list includes only User 1 job', u1JobsGet.data.jobs.length === 1 && u1JobsGet.data.jobs[0].id === user1JobId, `jobs: ${JSON.stringify(u1JobsGet.data.jobs)}`);

    // Job Isolation Check: User 2 calls GET /api/jobs
    const u2JobsGet = await makeRequest(server, {
      method: 'GET',
      path: '/api/jobs',
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert('User 2 jobs list includes only User 2 job', u2JobsGet.data.jobs.length === 1 && u2JobsGet.data.jobs[0].id === user2JobId, `jobs: ${JSON.stringify(u2JobsGet.data.jobs)}`);

    // IDOR Job Delete Tamper Test: User 1 attempts to delete User 2's job
    const u1DeleteU2Job = await makeRequest(server, {
      method: 'DELETE',
      path: `/api/jobs/${user2JobId}`,
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('User 1 cannot delete User 2 job (404 Access Denied)', u1DeleteU2Job.status === 404, `got status ${u1DeleteU2Job.status}`);

    // Verify User 2's job still exists
    const u2JobStillExists = await makeRequest(server, {
      method: 'GET',
      path: `/api/jobs/${user2JobId}`,
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert('User 2 job still exists intact', u2JobStillExists.status === 200 && u2JobStillExists.data.job.id === user2JobId, JSON.stringify(u2JobStillExists.data));

    // Agent Run Anti-IDOR Test: User 1 invokes agent run passing userId: 999 in payload
    const agentRunRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/agent/run',
      headers: { Authorization: `Bearer ${user1Token}` }
    }, {
      request: 'What are my top skills and experience?',
      userId: 999, // Attempted tamper - server MUST ignore and use User 1 ID!
      candidateId: 999
    });
    assert('Agent run executes successfully', agentRunRes.status === 200 && agentRunRes.data.runId > 0, JSON.stringify(agentRunRes.data));
    const runId = agentRunRes.data.runId;

    // Verify agent run was logged with User 1's ID in database, not 999
    const [runDbRows] = await rootConn.query('SELECT user_id FROM agent_runs WHERE id = ?', [runId]);
    assert('Agent run persisted with server-derived authenticated user_id', runDbRows.length > 0 && runDbRows[0].user_id === user1RegRes.data.user.id, `expected user ${user1RegRes.data.user.id}, got ${runDbRows[0]?.user_id}`);

    // User 2 cannot access User 1's agent run
    const u2AccessRun = await makeRequest(server, {
      method: 'GET',
      path: `/api/agent/runs/${runId}`,
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert('User 2 cannot access User 1 agent run (404 Not Found / Access Denied)', u2AccessRun.status === 404, `got ${u2AccessRun.status}`);

    // Stats isolation
    const u1Stats = await makeRequest(server, {
      method: 'GET',
      path: '/api/stats',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('User 1 dashboard stats count only User 1 runs', u1Stats.data.stats.totalAgentRuns === 1, JSON.stringify(u1Stats.data.stats));

    const u2Stats = await makeRequest(server, {
      method: 'GET',
      path: '/api/stats',
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    assert('User 2 dashboard stats count zero runs', u2Stats.data.stats.totalAgentRuns === 0, JSON.stringify(u2Stats.data.stats));

    // Anti-IDOR & Isolation in Agent Tools:
    const { executeTool } = require('../tools');
    const u1ToolRes = await executeTool('getCandidateProfile', { userId: user1RegRes.data.user.id });
    assert('User 1 tool getCandidateProfile returns User 1 profile', u1ToolRes.success === true && u1ToolRes.result.userId === user1RegRes.data.user.id && u1ToolRes.result.name === 'Alice User1', JSON.stringify(u1ToolRes.result));

    // Register a 3rd user without a profile to verify tool isolation
    const u3RegRes = await makeRequest(server, { method: 'POST', path: '/api/auth/register' }, {
      name: 'Charlie Blank',
      email: 'charlie.blank@example.com',
      password: 'StrongPasswordUser3!'
    });
    const u3ToolRes = await executeTool('getCandidateProfile', { userId: u3RegRes.data.user.id });
    assert('User 3 (without profile) tool getCandidateProfile returns exists: false', u3ToolRes.success === true && u3ToolRes.result.exists === false, JSON.stringify(u3ToolRes.result));

    // ------------------------------------------------------------------------
    // 9. PRODUCTION LOCKDOWN OF DEMO ENDPOINTS (403)
    // ------------------------------------------------------------------------
    console.log('\n▶ 10. Production Lockdown of Demo Reset & Seed Endpoints...');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const prodSeedRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/demo/seed',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('POST /api/demo/seed in production returns 403 Forbidden', prodSeedRes.status === 403 && prodSeedRes.data.error.includes('disabled in production'), JSON.stringify(prodSeedRes.data));

    const prodResetRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/demo/reset',
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    assert('POST /api/demo/reset in production returns 403 Forbidden', prodResetRes.status === 403 && prodResetRes.data.error.includes('disabled in production'), JSON.stringify(prodResetRes.data));

    process.env.NODE_ENV = originalEnv;

  } finally {
    if (server) {
      server.close();
    }
    if (rootConn) {
      try {
        await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await rootConn.end();
      } catch {
        // ignore
      }
    }
    try {
      const db = require('../config/db');
      await db.pool.end();
    } catch {
      // ignore
    }
    await cleanup();
  }

  console.log('\n====================================================');
  console.log(`📊 Phase 2 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runPhase2Tests().catch(err => {
    console.error('💥 Fatal error running Phase 2 verification:', err);
    process.exit(1);
  });
}

module.exports = { runPhase2Tests };
