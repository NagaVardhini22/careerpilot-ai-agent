/**
 * AI Agent Orchestrator Service
 * Executes autonomous agent loop with function calling and MySQL audit logging.
 */

const db = require('../config/db');
const { getToolDefinitions, executeTool } = require('../tools');
const { callLLM } = require('./llmService');

const SYSTEM_PROMPT = `You are CareerPilot, an autonomous AI career agent and interview preparation advisor.
Your objective is to assist the candidate in evaluating career opportunities, calculating realistic skill matches, identifying skill gaps, and generating targeted interview preparation questions.

Rules:
1. Always use the available backend tools to retrieve real candidate data, saved jobs, and historical records.
2. NEVER invent job listings, candidate skills, or match percentages without calling tools.
3. When asked to evaluate saved jobs, retrieve the candidate profile and saved jobs first, calculate the match score, and if requested, generate interview questions.
4. Save important analyses to the database using the saveJobAnalysis tool.
5. Provide clear, professional, constructive answers formatted in GitHub-flavored Markdown.`;

/**
 * Generate human-readable, safe summary for frontend activity timeline
 */
function createActivitySummary(toolName, result) {
  switch (toolName) {
    case 'getCandidateProfile':
      return `Retrieved candidate profile for ${result?.name || 'candidate'} (${result?.skillsCount || 0} skills indexed)`;
    case 'getSavedJobs':
      return `Retrieved ${result?.totalFound || 0} saved jobs from database`;
    case 'getJobDetails':
      return `Loaded full job requirements for "${result?.title || 'Job'}" at ${result?.company || 'Company'}`;
    case 'analyzeJobRequirements':
      return `Analyzed requirements: ${result?.requiredSkills?.length || 0} core skills detected`;
    case 'calculateJobMatch':
      return `Calculated compatibility for "${result?.jobTitle}": ${result?.matchScore}% match score`;
    case 'saveJobAnalysis':
      return `Persisted job analysis and recommendations to database (Analysis ID: ${result?.analysisId})`;
    case 'generateInterviewQuestions':
      return `Generated tailored technical, behavioral, and gap interview questions for "${result?.jobTitle}"`;
    case 'getApplicationHistory':
      return `Retrieved application tracking history (${result?.totalApplications || 0} applications, ${result?.totalAnalyses || 0} analyses)`;
    default:
      return `Executed backend tool: ${toolName}`;
  }
}

/**
 * Run AI Agent Orchestration Loop
 * 
 * @param {string} userRequest - The candidate's natural language prompt
 * @param {number} userId - The user ID (default 1)
 * @param {number} candidateId - The candidate profile ID (default 1)
 */
async function runAgent(userRequest, userId = 1, candidateId = 1) {
  if (!userRequest || typeof userRequest !== 'string' || userRequest.trim() === '') {
    throw new Error('User request cannot be empty.');
  }

  const startTime = Date.now();

  // Safely resolve userId if valid in users table (allows guest runs before onboarding)
  let validUserId = null;
  if (userId) {
    const userCheck = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userCheck && userCheck.length > 0) {
      validUserId = userId;
    }
  }

  // 1. Create agent run record in MySQL
  const runInsert = await db.query(
    'INSERT INTO agent_runs (user_id, user_request, status, created_at) VALUES (?, ?, ?, NOW())',
    [validUserId, userRequest.trim(), 'running']
  );
  const runId = runInsert.insertId;

  const toolDefinitions = getToolDefinitions();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userRequest.trim() }
  ];

  const activities = [
    {
      step: 1,
      tool: 'agent_orchestrator',
      status: 'success',
      summary: 'Received request and initialized autonomous agent loop'
    }
  ];

  let iterations = 0;
  const maxIterations = 8;
  let finalResponse = null;

  try {
    while (iterations < maxIterations) {
      iterations++;

      // Invoke LLM (real provider or mock agent planner)
      const llmOutput = await callLLM(messages, toolDefinitions);

      // Check if LLM requested tool execution
      if (llmOutput.tool_calls && llmOutput.tool_calls.length > 0) {
        // Append assistant message with tool calls to context
        messages.push({
          role: 'assistant',
          content: llmOutput.content || null,
          tool_calls: llmOutput.tool_calls
        });

        // Execute each requested tool
        for (const toolCall of llmOutput.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          } catch {
            toolArgs = {};
          }

          // Inject candidateId if not provided
          if (!toolArgs.candidateId) {
            toolArgs.candidateId = candidateId;
          }

          // Execute tool securely
          const execution = await executeTool(toolName, toolArgs);

          // Log tool execution in database
          await db.query(
            `INSERT INTO agent_tool_calls (run_id, tool_name, arguments, result, status, execution_time_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              runId,
              toolName,
              JSON.stringify(toolArgs),
              JSON.stringify(execution.result || { error: execution.error }),
              execution.success ? 'success' : 'failed',
              execution.durationMs
            ]
          );

          // Track safe activity step for frontend
          activities.push({
            step: activities.length + 1,
            tool: toolName,
            status: execution.success ? 'success' : 'failed',
            summary: execution.success
              ? createActivitySummary(toolName, execution.result)
              : `Tool ${toolName} failed: ${execution.error}`
          });

          // Append tool result message to conversation history
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(execution.result || { error: execution.error })
          });
        }
      } else {
        // LLM completed and provided final answer
        finalResponse = llmOutput.content;
        break;
      }
    }

    if (!finalResponse) {
      finalResponse = 'Agent reached maximum iteration limit without finalizing. Review tool activity for partial results.';
    }

    const durationMs = Date.now() - startTime;

    // Update agent run status to completed in MySQL
    await db.query(
      `UPDATE agent_runs 
       SET status = 'completed', final_response = ?, total_iterations = ?, duration_ms = ?, completed_at = NOW()
       WHERE id = ?`,
      [finalResponse, iterations, durationMs, runId]
    );

    activities.push({
      step: activities.length + 1,
      tool: 'agent_orchestrator',
      status: 'success',
      summary: `Completed agent workflow successfully in ${iterations} iterations (${durationMs}ms)`
    });

    return {
      runId,
      status: 'completed',
      finalResponse,
      totalIterations: iterations,
      durationMs,
      activities
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[Agent Run #${runId} Failed]`, error.message);

    await db.query(
      `UPDATE agent_runs 
       SET status = 'failed', error_message = ?, total_iterations = ?, duration_ms = ?, completed_at = NOW()
       WHERE id = ?`,
      [error.message, iterations, durationMs, runId]
    );

    activities.push({
      step: activities.length + 1,
      tool: 'agent_orchestrator',
      status: 'failed',
      summary: `Agent execution failed: ${error.message}`
    });

    return {
      runId,
      status: 'failed',
      error: error.message,
      activities,
      durationMs
    };
  }
}

/**
 * Retrieve recent agent runs
 */
async function getAgentRuns(limit = 20) {
  const rows = await db.query(
    `SELECT ar.id, ar.user_id, ar.user_request, ar.status, ar.total_iterations, 
            ar.duration_ms, ar.created_at, ar.completed_at,
            (SELECT COUNT(*) FROM agent_tool_calls atc WHERE atc.run_id = ar.id) AS tool_call_count
     FROM agent_runs ar
     ORDER BY ar.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

/**
 * Retrieve single agent run with all tool calls
 */
async function getAgentRunById(runId) {
  const runRows = await db.query('SELECT * FROM agent_runs WHERE id = ?', [runId]);
  if (!runRows || runRows.length === 0) {
    return null;
  }
  const run = runRows[0];

  const toolCalls = await db.query(
    'SELECT id, tool_name, arguments, result, status, execution_time_ms, created_at FROM agent_tool_calls WHERE run_id = ? ORDER BY id ASC',
    [runId]
  );

  return {
    ...run,
    toolCalls: toolCalls.map(tc => ({
      id: tc.id,
      toolName: tc.tool_name,
      arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments,
      result: typeof tc.result === 'string' ? JSON.parse(tc.result) : tc.result,
      status: tc.status,
      executionTimeMs: tc.execution_time_ms,
      createdAt: tc.created_at
    }))
  };
}

module.exports = {
  runAgent,
  getAgentRuns,
  getAgentRunById
};
