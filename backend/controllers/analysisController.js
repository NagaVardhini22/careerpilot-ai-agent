/**
 * Analysis, Applications, and Dashboard Stats Controller
 */

const db = require('../config/db');
const { seedDatabase } = require('../../database/seedDb');
const { initDatabase } = require('../../database/initDb');

async function getAnalyses(req, res, next) {
  try {
    const candidateId = req.query.candidateId ? parseInt(req.query.candidateId, 10) : null;
    let sql = `
      SELECT ja.id, ja.job_id, ja.candidate_id, ja.match_score, ja.matched_skills, 
             ja.missing_skills, ja.recommendations, ja.interview_readiness, ja.created_at,
             j.title AS job_title, j.company, j.location
      FROM job_analyses ja
      JOIN jobs j ON ja.job_id = j.id
    `;
    const params = [];
    if (candidateId) {
      sql += ' WHERE ja.candidate_id = ?';
      params.push(candidateId);
    }
    sql += ' ORDER BY ja.created_at DESC';

    const rows = await db.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      analyses: rows.map(r => ({
        id: r.id,
        jobId: r.job_id,
        candidateId: r.candidate_id,
        jobTitle: r.job_title,
        company: r.company,
        location: r.location,
        matchScore: r.match_score,
        matchedSkills: typeof r.matched_skills === 'string' ? JSON.parse(r.matched_skills) : r.matched_skills,
        missingSkills: typeof r.missing_skills === 'string' ? JSON.parse(r.missing_skills) : r.missing_skills,
        recommendations: typeof r.recommendations === 'string' ? JSON.parse(r.recommendations) : r.recommendations,
        interviewReadiness: r.interview_readiness,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function getAnalysisById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = await db.query(
      `SELECT ja.*, j.title AS job_title, j.company, j.location, j.description, j.experience_required
       FROM job_analyses ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE ja.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: `Analysis #${id} not found.` });
    }

    const r = rows[0];
    return res.json({
      success: true,
      analysis: {
        id: r.id,
        jobId: r.job_id,
        candidateId: r.candidate_id,
        jobTitle: r.job_title,
        company: r.company,
        location: r.location,
        jobDescription: r.description,
        experienceRequired: r.experience_required,
        matchScore: r.match_score,
        matchedSkills: typeof r.matched_skills === 'string' ? JSON.parse(r.matched_skills) : r.matched_skills,
        missingSkills: typeof r.missing_skills === 'string' ? JSON.parse(r.missing_skills) : r.missing_skills,
        recommendations: typeof r.recommendations === 'string' ? JSON.parse(r.recommendations) : r.recommendations,
        interviewReadiness: r.interview_readiness,
        createdAt: r.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getApplications(req, res, next) {
  try {
    const candidateId = req.query.candidateId ? parseInt(req.query.candidateId, 10) : null;
    let sql = `
      SELECT a.id, a.job_id, a.candidate_id, a.status, a.applied_date, a.notes, a.created_at,
             j.title AS job_title, j.company, j.location, j.work_mode
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
    `;
    const params = [];
    if (candidateId) {
      sql += ' WHERE a.candidate_id = ?';
      params.push(candidateId);
    }
    sql += ' ORDER BY a.created_at DESC';

    const rows = await db.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      applications: rows.map(r => ({
        id: r.id,
        jobId: r.job_id,
        candidateId: r.candidate_id,
        jobTitle: r.job_title,
        company: r.company,
        location: r.location,
        workMode: r.work_mode,
        status: r.status,
        appliedDate: r.applied_date,
        notes: r.notes,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    // 1. Total Saved Jobs
    const jobsRows = await db.query('SELECT COUNT(*) AS count FROM jobs');
    const jobsCount = jobsRows[0] ? jobsRows[0].count : 0;

    // 2. Analyzed Jobs
    const analyzedRows = await db.query('SELECT COUNT(DISTINCT job_id) AS count, AVG(match_score) AS avg_score FROM job_analyses');
    const analyzedCount = analyzedRows[0] ? analyzedRows[0].count : 0;
    const avgScore = analyzedRows[0] && analyzedRows[0].avg_score ? Math.round(parseFloat(analyzedRows[0].avg_score)) : 0;

    // 3. Agent Runs
    const runsRows = await db.query('SELECT COUNT(*) AS count FROM agent_runs');
    const runsCount = runsRows[0] ? runsRows[0].count : 0;

    // 4. Candidate count
    const profileRows = await db.query('SELECT COUNT(*) AS count FROM candidate_profiles');
    const hasProfile = profileRows[0] ? profileRows[0].count > 0 : false;

    // 5. Recent Agent Activity
    const recentRuns = await db.query(
      'SELECT id, user_request, status, total_iterations, duration_ms, created_at FROM agent_runs ORDER BY created_at DESC LIMIT 5'
    );

    return res.json({
      success: true,
      stats: {
        totalSavedJobs: jobsCount,
        totalAnalyzedJobs: analyzedCount,
        averageMatchScore: avgScore,
        totalAgentRuns: runsCount,
        hasProfile,
        recentRuns
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Explicit demo seed endpoint for technical interview testing
 */
async function seedDemoData(req, res, next) {
  try {
    await seedDatabase();
    return res.json({
      success: true,
      message: 'Demo dataset successfully loaded. You can now test the agent with pre-populated jobs and profile!'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset database to fresh empty state
 */
async function resetDatabase(req, res, next) {
  try {
    await initDatabase();
    return res.json({
      success: true,
      message: 'Database reset to clean empty state. All user data, jobs, and history cleared.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnalyses,
  getAnalysisById,
  getApplications,
  getStats,
  seedDemoData,
  resetDatabase
};
