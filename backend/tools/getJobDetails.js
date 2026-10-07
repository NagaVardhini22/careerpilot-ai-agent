/**
 * Tool: getJobDetails
 * Purpose: Retrieve the complete details of a specific job.
 */

const db = require('../config/db');

async function getJobDetails(args = {}) {
  let { jobId, jobTitle } = args;

  let sql = 'SELECT * FROM jobs WHERE ';
  const params = [];

  if (jobId) {
    sql += 'id = ?';
    params.push(jobId);
  } else if (jobTitle) {
    sql += 'title LIKE ?';
    params.push(`%${jobTitle}%`);
  } else {
    throw new Error('Either jobId or jobTitle must be provided to getJobDetails.');
  }

  const rows = await db.query(sql, params);
  if (!rows || rows.length === 0) {
    throw new Error(`Job not found with criteria: ${JSON.stringify(args)}`);
  }

  const job = rows[0];
  let requiredSkills = [];
  try {
    requiredSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : (job.required_skills || []);
  } catch {
    requiredSkills = [];
  }

  // Fetch any past analysis
  const analyses = await db.query(
    'SELECT id, match_score, matched_skills, missing_skills, recommendations, interview_readiness, created_at FROM job_analyses WHERE job_id = ? ORDER BY created_at DESC LIMIT 1',
    [job.id]
  );

  let pastAnalysis = null;
  if (analyses.length > 0) {
    const a = analyses[0];
    pastAnalysis = {
      id: a.id,
      matchScore: a.match_score,
      matchedSkills: typeof a.matched_skills === 'string' ? JSON.parse(a.matched_skills) : a.matched_skills,
      missingSkills: typeof a.missing_skills === 'string' ? JSON.parse(a.missing_skills) : a.missing_skills,
      recommendations: typeof a.recommendations === 'string' ? JSON.parse(a.recommendations) : a.recommendations,
      interviewReadiness: a.interview_readiness,
      analyzedAt: a.created_at
    };
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.work_mode,
    salaryRange: job.salary_range,
    description: job.description,
    requiredSkills,
    experienceRequired: job.experience_required,
    status: job.status,
    pastAnalysis
  };
}

module.exports = {
  name: 'getJobDetails',
  description: 'Retrieve the complete details of a specific job by jobId (e.g. 1) or matching jobTitle.',
  parameters: {
    type: 'object',
    properties: {
      jobId: {
        type: 'integer',
        description: 'The unique ID of the job to retrieve.'
      },
      jobTitle: {
        type: 'string',
        description: 'The title of the job to search for if jobId is not known.'
      }
    }
  },
  execute: getJobDetails
};
