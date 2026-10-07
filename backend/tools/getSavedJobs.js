/**
 * Tool: getSavedJobs
 * Purpose: Retrieve jobs saved by the candidate with optional keyword/status filtering.
 */

const db = require('../config/db');

async function getSavedJobs(args = {}) {
  const status = args.status || 'saved';
  const keyword = args.keyword ? `%${args.keyword}%` : null;
  const limit = Math.min(Math.max(parseInt(args.limit || 10, 10), 1), 50);

  let sql = `
    SELECT j.id, j.title, j.company, j.location, j.work_mode, j.salary_range, 
           j.required_skills, j.experience_required, j.status, j.created_at,
           (SELECT match_score FROM job_analyses ja WHERE ja.job_id = j.id ORDER BY ja.created_at DESC LIMIT 1) AS last_match_score
    FROM jobs j
    WHERE 1=1
  `;
  const params = [];

  if (status !== 'all') {
    sql += ` AND j.status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ?)`;
    params.push(keyword, keyword, keyword);
  }

  sql += ` ORDER BY j.created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = await db.query(sql, params);

  const jobs = rows.map(r => {
    let parsedSkills = [];
    try {
      parsedSkills = typeof r.required_skills === 'string' ? JSON.parse(r.required_skills) : (r.required_skills || []);
    } catch {
      parsedSkills = [];
    }

    return {
      id: r.id,
      title: r.title,
      company: r.company,
      location: r.location,
      workMode: r.work_mode,
      salaryRange: r.salary_range,
      requiredSkills: parsedSkills,
      experienceRequired: r.experience_required,
      status: r.status,
      lastMatchScore: r.last_match_score !== null ? parseInt(r.last_match_score, 10) : null
    };
  });

  return {
    totalFound: jobs.length,
    filterApplied: { status, keyword: args.keyword || null },
    jobs
  };
}

module.exports = {
  name: 'getSavedJobs',
  description: 'Retrieve saved jobs with optional keyword filtering (e.g., "JavaScript", "Frontend") and status filtering.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['saved', 'applied', 'archived', 'all'],
        description: 'Filter by job status. Defaults to "saved". Use "all" to view everything.'
      },
      keyword: {
        type: 'string',
        description: 'Optional search keyword to match job title, company, or description.'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of jobs to return. Defaults to 10.'
      }
    }
  },
  execute: getSavedJobs
};
