/**
 * Job Search Controller
 * Handles live external job search, provider status queries, and saving jobs to board.
 */

const jobAggregatorService = require('../services/jobProviders/jobAggregatorService');

async function searchLiveJobs(req, res, next) {
  try {
    const { keyword, location, remoteOnly, experienceLevel, provider } = req.query;
    const results = await jobAggregatorService.searchJobs({
      keyword,
      location,
      remoteOnly: remoteOnly === 'true' || remoteOnly === '1',
      experienceLevel,
      provider
    });

    return res.json(results);
  } catch (error) {
    next(error);
  }
}

async function getProvidersStatus(req, res, next) {
  try {
    const providers = jobAggregatorService.getProvidersStatus();
    return res.json({
      success: true,
      providers
    });
  } catch (error) {
    next(error);
  }
}

async function saveExternalJob(req, res, next) {
  try {
    const result = await jobAggregatorService.saveExternalJobToBoard(req.body, req.user.id);
    return res.status(result.alreadySaved ? 200 : 201).json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
}

module.exports = {
  searchLiveJobs,
  getProvidersStatus,
  saveExternalJob
};
