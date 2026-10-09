/**
 * Tool Registry & Execution Dispatcher
 * Central registry mapping tool names to schemas and implementations.
 */

const getCandidateProfile = require('./getCandidateProfile');
const getSavedJobs = require('./getSavedJobs');
const getJobDetails = require('./getJobDetails');
const analyzeJobRequirements = require('./analyzeJobRequirements');
const calculateJobMatch = require('./calculateJobMatch');
const saveJobAnalysis = require('./saveJobAnalysis');
const generateInterviewQuestions = require('./generateInterviewQuestions');
const getApplicationHistory = require('./getApplicationHistory');
const searchLiveJobs = require('./searchLiveJobs');

const toolsList = [
  getCandidateProfile,
  getSavedJobs,
  getJobDetails,
  analyzeJobRequirements,
  calculateJobMatch,
  saveJobAnalysis,
  generateInterviewQuestions,
  getApplicationHistory,
  searchLiveJobs
];

const toolsByName = new Map();
toolsList.forEach(tool => {
  toolsByName.set(tool.name, tool);
});

/**
 * Return tool definitions in OpenAI Function Calling standard JSON schema
 */
function getToolDefinitions() {
  return toolsList.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/**
 * Execute a registered tool by name with arguments
 * Validates tool existence and records execution duration.
 * 
 * @param {string} toolName 
 * @param {object} args 
 * @returns {Promise<{ result: any, durationMs: number }>}
 */
async function executeTool(toolName, args = {}) {
  const tool = toolsByName.get(toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" is not registered in the agent tool catalog.`);
  }

  // Parse args if string was passed
  let parsedArgs = args;
  if (typeof args === 'string') {
    try {
      parsedArgs = JSON.parse(args);
    } catch {
      parsedArgs = {};
    }
  }

  const startTime = Date.now();
  try {
    const result = await tool.execute(parsedArgs);
    const durationMs = Date.now() - startTime;
    return {
      success: true,
      result,
      durationMs
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      error: error.message,
      durationMs
    };
  }
}

module.exports = {
  toolsList,
  toolsByName,
  toolRegistry: toolsByName,
  getToolDefinitions,
  executeTool
};
