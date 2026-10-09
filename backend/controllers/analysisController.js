/**
 * Analysis, Applications, and Dashboard Stats Controller
 * Enforces per-user ownership and unconditionally disables demo/reset in production.
 */

const db = require('../config/db');
const { seedDatabase } = require('../../database/seedDb');
const { initDatabase } = require('../../database/initDb');

async function getCandidateIdForUser(userId) {
  const rows = await db.query(
    'SELECT id FROM candidate_profiles WHERE user_id = ? AND (is_legacy = FALSE OR is_legacy IS NULL) ORDER BY id DESC LIMIT 1',
    [userId]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function getAnalyses(req, res, next) {
  try {
    const candidateId = await getCandidateIdForUser(req.user.id);
    if (!candidateId) {
      return res.json({ success: true, count: 0, analyses: [] });
    }

    const sql = `
      SELECT ja.id, ja.job_id, ja.candidate_id, ja.match_score, ja.matched_skills, 
             ja.missing_skills, ja.recommendations, ja.interview_readiness, ja.created_at,
             j.title AS job_title, j.company, j.location
      FROM job_analyses ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.candidate_id = ?
      ORDER BY ja.created_at DESC
    `;

    const rows = await db.query(sql, [candidateId]);

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
    const candidateId = await getCandidateIdForUser(req.user.id);

    const rows = await db.query(
      `SELECT ja.*, j.title AS job_title, j.company, j.location, j.description, j.experience_required
       FROM job_analyses ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE ja.id = ? AND ja.candidate_id = ?`,
      [id, candidateId || 0]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: `Analysis #${id} not found or access denied.` });
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
    const candidateId = await getCandidateIdForUser(req.user.id);
    if (!candidateId) {
      return res.json({ success: true, count: 0, applications: [] });
    }

    const sql = `
      SELECT a.id, a.job_id, a.candidate_id, a.status, a.applied_date, a.notes, a.created_at,
             j.title AS job_title, j.company, j.location, j.work_mode
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.candidate_id = ?
      ORDER BY a.created_at DESC
    `;

    const rows = await db.query(sql, [candidateId]);

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
    const userId = req.user.id;
    const candidateId = await getCandidateIdForUser(userId);

    // 1. Total Saved Jobs for authenticated user
    const jobsRows = await db.query('SELECT COUNT(*) AS count FROM jobs WHERE user_id = ? OR user_id IS NULL', [userId]);
    const jobsCount = jobsRows[0] ? jobsRows[0].count : 0;

    // 2. Analyzed Jobs for authenticated user's candidate profile
    let analyzedCount = 0;
    let avgScore = 0;
    if (candidateId) {
      const analyzedRows = await db.query(
        'SELECT COUNT(DISTINCT job_id) AS count, AVG(match_score) AS avg_score FROM job_analyses WHERE candidate_id = ?',
        [candidateId]
      );
      analyzedCount = analyzedRows[0] ? analyzedRows[0].count : 0;
      avgScore = analyzedRows[0] && analyzedRows[0].avg_score ? Math.round(parseFloat(analyzedRows[0].avg_score)) : 0;
    }

    // 3. Agent Runs for authenticated user
    const runsRows = await db.query('SELECT COUNT(*) AS count FROM agent_runs WHERE user_id = ?', [userId]);
    const runsCount = runsRows[0] ? runsRows[0].count : 0;

    // 4. Candidate profile status
    const hasProfile = candidateId !== null;

    // 5. Recent Agent Activity for authenticated user
    const recentRuns = await db.query(
      'SELECT id, user_request, status, total_iterations, duration_ms, created_at FROM agent_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
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
 * Demo seed endpoint
 * Unconditionally disabled in production.
 */
async function seedDemoData(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Database administration endpoints are disabled in production. Run database commands via server CLI.'
      });
    }

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
 * Unconditionally disabled in production.
 */
async function resetDatabase(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Database administration endpoints are disabled in production. Run database commands via server CLI.'
      });
    }

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
