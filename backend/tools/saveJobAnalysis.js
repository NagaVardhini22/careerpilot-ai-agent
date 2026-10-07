/**
 * Tool: saveJobAnalysis
 * Purpose: Save job analysis and match information into MySQL database.
 */

const db = require('../config/db');

async function saveJobAnalysis(args = {}) {
  const {
    jobId,
    candidateId = 1,
    matchScore,
    matchedSkills = [],
    missingSkills = [],
    keyStrengths = [],
    recommendations = [],
    interviewReadiness = 'Moderate'
  } = args;

  if (!jobId || matchScore === undefined) {
    throw new Error('jobId and matchScore are required to save a job analysis.');
  }

  // Ensure JSON formatting for structured columns
  const matchedSkillsJson = JSON.stringify(matchedSkills);
  const missingSkillsJson = JSON.stringify(missingSkills);
  const keyStrengthsJson = JSON.stringify(keyStrengths);
  const recommendationsJson = JSON.stringify(recommendations);

  const result = await db.query(
    `INSERT INTO job_analyses 
     (job_id, candidate_id, match_score, matched_skills, missing_skills, key_strengths, recommendations, interview_readiness)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      candidateId,
      matchScore,
      matchedSkillsJson,
      missingSkillsJson,
      keyStrengthsJson,
      recommendationsJson,
      interviewReadiness
    ]
  );

  return {
    success: true,
    analysisId: result.insertId,
    jobId,
    candidateId,
    matchScore,
    message: `Job analysis saved successfully to database with ID ${result.insertId}.`
  };
}

module.exports = {
  name: 'saveJobAnalysis',
  description: 'Persist calculated job match analysis, matched/missing skills, and recommendations to the MySQL database.',
  parameters: {
    type: 'object',
    properties: {
      jobId: {
        type: 'integer',
        description: 'The job ID analyzed.'
      },
      candidateId: {
        type: 'integer',
        description: 'Optional candidate ID. Defaults to 1.'
      },
      matchScore: {
        type: 'integer',
        description: 'The overall match percentage score (0-100).'
      },
      matchedSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of candidate skills that match the job.'
      },
      missingSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of required skills candidate is missing or needs improvement on.'
      },
      keyStrengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key candidate strengths for this role.'
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Preparation advice and action items for the candidate.'
      },
      interviewReadiness: {
        type: 'string',
        enum: ['High', 'Moderate', 'Low'],
        description: 'Readiness evaluation.'
      }
    },
    required: ['jobId', 'matchScore', 'matchedSkills', 'recommendations']
  },
  execute: saveJobAnalysis
};
