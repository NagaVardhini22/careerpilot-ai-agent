/**
 * Job Service
 * Handles CRUD operations, filtering, and direct analysis trigger for jobs.
 */

const db = require('../config/db');
const calculateJobMatch = require('../tools/calculateJobMatch');
const saveJobAnalysis = require('../tools/saveJobAnalysis');

/**
 * Retrieve jobs with optional filters
 */
async function getJobs(filters = {}) {
  const { status, keyword } = filters;

  let sql = `
    SELECT j.id, j.user_id, j.title, j.company, j.location, j.work_mode, j.salary_range,
           j.description, j.required_skills, j.experience_required, j.status, j.created_at,
           (SELECT match_score FROM job_analyses ja WHERE ja.job_id = j.id ORDER BY ja.created_at DESC LIMIT 1) AS last_match_score,
           (SELECT interview_readiness FROM job_analyses ja WHERE ja.job_id = j.id ORDER BY ja.created_at DESC LIMIT 1) AS last_readiness
    FROM jobs j
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND j.status = ?';
    params.push(status);
  }

  if (keyword) {
    sql += ' AND (j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  sql += ' ORDER BY j.created_at DESC';

  const rows = await db.query(sql, params);

  return rows.map(r => {
    let parsedSkills = [];
    try {
      parsedSkills = typeof r.required_skills === 'string' ? JSON.parse(r.required_skills) : (r.required_skills || []);
    } catch {
      parsedSkills = [];
    }

    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      company: r.company,
      location: r.location,
      workMode: r.work_mode,
      salaryRange: r.salary_range,
      description: r.description,
      requiredSkills: parsedSkills,
      experienceRequired: r.experience_required,
      status: r.status,
      lastMatchScore: r.last_match_score !== null ? parseInt(r.last_match_score, 10) : null,
      lastReadiness: r.last_readiness || null,
      createdAt: r.created_at
    };
  });
}

/**
 * Retrieve a single job by ID with analysis history
 */
async function getJobById(jobId) {
  const rows = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
  if (!rows || rows.length === 0) {
    return null;
  }
  const job = rows[0];

  let parsedSkills = [];
  try {
    parsedSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : (job.required_skills || []);
  } catch {
    parsedSkills = [];
  }

  const analyses = await db.query(
    'SELECT * FROM job_analyses WHERE job_id = ? ORDER BY created_at DESC',
    [jobId]
  );

  return {
    id: job.id,
    userId: job.user_id,
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.work_mode,
    salaryRange: job.salary_range,
    description: job.description,
    requiredSkills: parsedSkills,
    experienceRequired: job.experience_required,
    status: job.status,
    createdAt: job.created_at,
    analyses: analyses.map(a => ({
      id: a.id,
      matchScore: a.match_score,
      matchedSkills: typeof a.matched_skills === 'string' ? JSON.parse(a.matched_skills) : a.matched_skills,
      missingSkills: typeof a.missing_skills === 'string' ? JSON.parse(a.missing_skills) : a.missing_skills,
      recommendations: typeof a.recommendations === 'string' ? JSON.parse(a.recommendations) : a.recommendations,
      interviewReadiness: a.interview_readiness,
      createdAt: a.created_at
    }))
  };
}

/**
 * Create a new job record
 */
async function createJob(data) {
  const {
    userId = null,
    title,
    company,
    location = 'Remote',
    workMode = 'Remote',
    salaryRange = '',
    description,
    requiredSkills = [],
    experienceRequired = '2-4 years',
    status = 'saved'
  } = data;

  if (!title || !company || !description) {
    throw new Error('Title, company, and description are required to create a job.');
  }

  let skillsArray = [];
  if (Array.isArray(requiredSkills)) {
    skillsArray = requiredSkills;
  } else if (typeof requiredSkills === 'string') {
    skillsArray = requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
  }

  const result = await db.query(
    `INSERT INTO jobs 
     (user_id, title, company, location, work_mode, salary_range, description, required_skills, experience_required, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      title.trim(),
      company.trim(),
      location.trim(),
      workMode,
      salaryRange.trim(),
      description.trim(),
      JSON.stringify(skillsArray),
      experienceRequired.trim(),
      status
    ]
  );

  return await getJobById(result.insertId);
}

/**
 * Delete a job by ID
 */
async function deleteJob(jobId) {
  await db.query('DELETE FROM jobs WHERE id = ?', [jobId]);
  return { success: true, message: `Job ${jobId} deleted.` };
}

/**
 * Directly analyze a job for a candidate
 */
async function analyzeJob(jobId, candidateId = null) {
  const matchResult = await calculateJobMatch.execute({ jobId, candidateId });
  const saveResult = await saveJobAnalysis.execute({
    jobId,
    candidateId: matchResult.candidateId,
    matchScore: matchResult.matchScore,
    matchedSkills: matchResult.matchedSkills,
    missingSkills: matchResult.missingSkills,
    keyStrengths: matchResult.keyStrengths,
    recommendations: matchResult.recommendations,
    interviewReadiness: matchResult.interviewReadiness
  });

  return {
    ...matchResult,
    analysisId: saveResult.analysisId
  };
}

module.exports = {
  getJobs,
  getJobById,
  createJob,
  deleteJob,
  analyzeJob
};
