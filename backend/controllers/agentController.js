/**
 * AI Agent Controller
 */

const agentService = require('../services/agentService');

async function runAgent(req, res, next) {
  try {
    const { request } = req.body;

    if (!request || typeof request !== 'string' || !request.trim()) {
      return res.status(400).json({
        success: false,
        error: 'The "request" field is required and must contain a non-empty string prompt.'
      });
    }

    // Strictly derive authenticated user ID from server auth context (anti-IDOR)
    const userId = req.user.id;

    const result = await agentService.runAgent(
      request,
      userId,
      null // candidateId automatically resolved to user's active profile in agentService
    );

    return res.json({
      success: result.status === 'completed',
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function getRuns(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const runs = await agentService.getAgentRuns(req.user.id, limit);
    return res.json({
      success: true,
      count: runs.length,
      runs
    });
  } catch (error) {
    next(error);
  }
}

async function getRunById(req, res, next) {
  try {
    const runId = parseInt(req.params.id, 10);
    const run = await agentService.getAgentRunById(runId, req.user.id);
    if (!run) {
      return res.status(404).json({ success: false, error: `Agent run #${runId} not found or access denied.` });
    }
    return res.json({
      success: true,
      run
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  runAgent,
  getRuns,
  getRunById
};
