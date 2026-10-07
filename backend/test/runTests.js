/**
 * Automated Verification & Test Suite
 * Tests REST endpoints, database queries, tool execution, and the AI agent loop.
 */

const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

async function runFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting CareerPilot Automated Verification Suite');
  console.log(`📡 Target Backend: ${BASE_URL}`);
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

  try {
    // Test 1: Healthcheck
    console.log('▶ 1. Healthcheck & Database Connection');
    const health = await runFetch('/api/health');
    assert('Server is online', health.status === 200);
    assert('Database is connected', health.data.databaseConnected === true);

    // Test 2: Clean Empty State Check
    console.log('\n▶ 2. Fresh Empty State Verification');
    await runFetch('/api/demo/reset', { method: 'POST' });
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
      body: JSON.stringify({ request: 'Which of my saved jobs is the best match?' })
    });
    assert('Agent handles empty state without crashing', agentEmpty.status === 200);
    assert('Agent advises candidate to create profile', agentEmpty.data.finalResponse.includes('profile'));

    // Test 4: Candidate Profile Creation (Onboarding)
    console.log('\n▶ 4. Candidate Profile Creation');
    const createProfRes = await runFetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Jordan Smith',
        email: 'jordan.smith@example.com',
        headline: 'Full-Stack Software Engineer | Node.js & MySQL',
        education: 'B.S. in Computer Science',
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

    // Test 6: Direct Job Analysis Tool
    console.log('\n▶ 6. Direct Job Compatibility Analysis');
    const analyzeRes = await runFetch(`/api/jobs/${createdJobId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ candidateId: createProfRes.data.profile.id })
    });
    assert('Analysis successful', analyzeRes.status === 200);
    assert('Match score computed (> 70%)', analyzeRes.data.analysis.matchScore >= 70);
    assert('Matched skills identified', analyzeRes.data.analysis.matchedSkills.length > 0);

    // Test 7: Autonomous Agent Orchestration Loop (Multiple Tool Calls)
    console.log('\n▶ 7. Autonomous Agent Loop Execution');
    const agentRunRes = await runFetch('/api/agent/run', {
      method: 'POST',
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
      body: JSON.stringify({ request: '   ' })
    });
    assert('Empty request rejected with 400', emptyPromptRes.status === 400);

    const invalidJobRes = await runFetch('/api/jobs/999999');
    assert('Invalid Job ID rejected with 404', invalidJobRes.status === 404);

    // Summary
    console.log('\n====================================================');
    console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite();
}

module.exports = { runTestSuite };
