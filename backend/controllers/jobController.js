/**
 * Job Controller
 * Derives user ID strictly from server authentication context.
 */

const jobService = require('../services/jobService');

async function getJobs(req, res, next) {
  try {
    const { status, keyword } = req.query;
    const jobs = await jobService.getJobs({ status, keyword, userId: req.user.id });
    return res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    next(error);
  }
}

async function getJobById(req, res, next) {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!jobId || isNaN(jobId)) {
      return res.status(400).json({ success: false, error: 'A valid job ID is required.' });
    }

    const job = await jobService.getJobById(jobId, req.user.id);
    if (!job) {
      return res.status(404).json({ success: false, error: `Job #${jobId} not found or access denied.` });
    }
    return res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
}

async function createJob(req, res, next) {
  try {
    const newJob = await jobService.createJob(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Job created successfully.',
      job: newJob
    });
  } catch (error) {
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
}

async function deleteJob(req, res, next) {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!jobId || isNaN(jobId)) {
      return res.status(400).json({ success: false, error: 'A valid job ID is required.' });
    }

    const result = await jobService.deleteJob(jobId, req.user.id);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('permission')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
}

async function analyzeJob(req, res, next) {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!jobId || isNaN(jobId)) {
      return res.status(400).json({ success: false, error: 'A valid job ID is required.' });
    }

    const analysis = await jobService.analyzeJob(jobId, null, req.user.id);
    return res.json({
      success: true,
      message: 'Job analyzed successfully.',
      analysis
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getJobs,
  getJobById,
  createJob,
  deleteJob,
  analyzeJob
};
