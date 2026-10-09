/**
 * Tool: searchLiveJobs (9th Controlled Agent Tool)
 * Purpose: Discover real job listings across external providers (Greenhouse, Lever, Adzuna, etc.)
 * and retrieve authentic search links for LinkedIn, Naukri, and Foundit.
 */

const jobAggregatorService = require('../services/jobProviders/jobAggregatorService');

async function searchLiveJobs(args = {}) {
  const { keyword, location, remoteOnly, experienceLevel } = args;

  const results = await jobAggregatorService.searchJobs({
    keyword,
    location,
    remoteOnly: remoteOnly === true || remoteOnly === 'true',
    experienceLevel
  });

  return {
    success: true,
    query: results.query,
    cached: results.cached,
    totalFound: results.totalJobsFound,
    providerSummaries: results.providerSummaries,
    sampleJobs: results.jobs.slice(0, 5).map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      workMode: j.workMode,
      skills: j.requiredSkills,
      source: j.sourceName,
      url: j.originalUrl
    })),
    externalSearchLinks: results.externalSearchLinks
  };
}

module.exports = {
  name: 'searchLiveJobs',
  description: 'Search for active, live external job postings across integrated company career boards (Greenhouse, Lever) and job search APIs, and generate direct portal search links for LinkedIn, Naukri, and Foundit.',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Job title, skill or role keyword to search for (e.g. "Python developer", "React Engineer").'
      },
      location: {
        type: 'string',
        description: 'Geographic location or city (e.g. "India", "Bangalore", "San Francisco").'
      },
      remoteOnly: {
        type: 'boolean',
        description: 'Filter strictly for remote jobs.'
      },
      experienceLevel: {
        type: 'string',
        description: 'Experience filter (e.g. "Entry-level", "Mid-level", "Senior").'
      }
    }
  },
  execute: searchLiveJobs
};
