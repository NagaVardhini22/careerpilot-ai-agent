/**
 * Job Controller
 */

const jobService = require('../services/jobService');

async function getJobs(req, res, next) {
  try {
    const { status, keyword } = req.query;
    const jobs = await jobService.getJobs({ status, keyword });
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
    const job = await jobService.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: `Job with ID ${jobId} not found.` });
    }
    return res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
}

async function createJob(req, res, next) {
  try {
    const newJob = await jobService.createJob(req.body);
    return res.status(201).json({
      success: true,
      message: 'Job created successfully.',
      job: newJob
    });
  } catch (error) {
    next(error);
  }
}

async function deleteJob(req, res, next) {
  try {
    const jobId = parseInt(req.params.id, 10);
    const result = await jobService.deleteJob(jobId);
    return res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function analyzeJob(req, res, next) {
  try {
    const jobId = parseInt(req.params.id, 10);
    const candidateId = req.body.candidateId ? parseInt(req.body.candidateId, 10) : null;
    const analysis = await jobService.analyzeJob(jobId, candidateId);
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
