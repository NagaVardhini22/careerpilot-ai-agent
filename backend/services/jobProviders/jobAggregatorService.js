/**
 * Job Aggregator Service
 * Orchestrates multi-provider external job discovery, caching, deduplication,
 * and saving external jobs to candidate's CareerPilot Board.
 */

const db = require('../../config/db');
const GreenhouseProvider = require('./greenhouseProvider');
const LeverProvider = require('./leverProvider');
const AdzunaProvider = require('./adzunaProvider');
const JoobleProvider = require('./joobleProvider');
const SerpApiProvider = require('./serpApiProvider');
const ExternalSearchLinkProvider = require('./externalSearchLinkProvider');

class JobAggregatorService {
  constructor() {
    this.greenhouse = new GreenhouseProvider();
    this.lever = new LeverProvider();
    this.adzuna = new AdzunaProvider();
    this.jooble = new JoobleProvider();
    this.serpApi = new SerpApiProvider();
    this.linkProvider = new ExternalSearchLinkProvider();

    // In-memory cache: key -> { timestamp, data }
    this.cache = new Map();
    this.cacheTtlMs = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Status of all integrated job providers
   */
  getProvidersStatus() {
    return [
      {
        id: 'greenhouse',
        name: 'Greenhouse Public Boards',
        type: 'api',
        configured: this.greenhouse.isConfigured(),
        requiresSecret: false,
        boardsConfigured: this.greenhouse.boards,
        notes: 'Official public API; no key required.'
      },
      {
        id: 'lever',
        name: 'Lever Public Postings',
        type: 'api',
        configured: this.lever.isConfigured(),
        requiresSecret: false,
        sitesConfigured: this.lever.sites,
        notes: 'Official public API; no key required.'
      },
      {
        id: 'adzuna',
        name: 'Adzuna Jobs',
        type: 'api',
        configured: this.adzuna.isConfigured(),
        requiresSecret: true,
        envVars: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],
        notes: 'Requires server-side app ID and key.'
      },
      {
        id: 'jooble',
        name: 'Jooble Job Search',
        type: 'api',
        configured: this.jooble.isConfigured(),
        requiresSecret: true,
        envVars: ['JOOBLE_API_KEY'],
        notes: 'Requires server-side API key.'
      },
      {
        id: 'serpapi',
        name: 'Google Jobs via SerpApi',
        type: 'api',
        configured: this.serpApi.isConfigured(),
        requiresSecret: true,
        envVars: ['SERPAPI_API_KEY'],
        notes: 'Requires server-side SerpApi key.'
      },
      {
        id: 'external_links',
        name: 'Direct Portal Search Links (LinkedIn, Naukri, Foundit)',
        type: 'links',
        configured: true,
        requiresSecret: false,
        notes: 'Compliant direct search URLs without scraping or CAPTCHA circumvention.'
      }
    ];
  }

  /**
   * Deduplicate jobs by lowercase title + company
   */
  deduplicateJobs(jobsList) {
    const seen = new Set();
    const unique = [];

    for (const job of jobsList) {
      const cleanTitle = (job.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCompany = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `${cleanTitle}__${cleanCompany}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }

  /**
   * Search jobs across all configured providers with caching and deduplication
   */
  async searchJobs(query = {}) {
    const {
      keyword = 'Software Engineer',
      location = '',
      remoteOnly = false,
      experienceLevel = '',
      provider: requestedProvider = null
    } = query;

    const cacheKey = JSON.stringify({
      keyword: (keyword || '').toLowerCase().trim(),
      location: (location || '').toLowerCase().trim(),
      remoteOnly: Boolean(remoteOnly),
      experienceLevel: (experienceLevel || '').toLowerCase().trim(),
      provider: requestedProvider || 'all'
    });

    const now = Date.now();
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && (now - cachedEntry.timestamp < this.cacheTtlMs)) {
      return {
        ...cachedEntry.data,
        cached: true,
        cachedAt: new Date(cachedEntry.timestamp).toISOString(),
        retrievedAt: new Date(cachedEntry.timestamp).toISOString()
      };
    }

    const providersToRun = [];

    if (!requestedProvider || requestedProvider === 'all' || requestedProvider === 'greenhouse') {
      providersToRun.push(this.greenhouse.searchJobs(query));
    }
    if (!requestedProvider || requestedProvider === 'all' || requestedProvider === 'lever') {
      providersToRun.push(this.lever.searchJobs(query));
    }
    if (!requestedProvider || requestedProvider === 'all' || requestedProvider === 'adzuna') {
      providersToRun.push(this.adzuna.searchJobs(query));
    }
    if (!requestedProvider || requestedProvider === 'all' || requestedProvider === 'jooble') {
      providersToRun.push(this.jooble.searchJobs(query));
    }
    if (!requestedProvider || requestedProvider === 'all' || requestedProvider === 'serpapi') {
      providersToRun.push(this.serpApi.searchJobs(query));
    }

    const settled = await Promise.allSettled(providersToRun);

    const providerSummaries = [];
    let aggregatedJobs = [];

    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value) {
        providerSummaries.push({
          provider: item.value.provider,
          displayName: item.value.displayName,
          status: item.value.status,
          count: item.value.count || 0,
          error: item.value.error || (item.value.errors ? item.value.errors.join('; ') : undefined),
          message: item.value.message
        });

        if (Array.isArray(item.value.jobs)) {
          aggregatedJobs.push(...item.value.jobs);
        }
      } else {
        providerSummaries.push({
          status: 'error',
          error: item.reason?.message || 'Provider execution failed'
        });
      }
    }

    const uniqueJobs = this.deduplicateJobs(aggregatedJobs);
    const externalLinks = this.linkProvider.generateSearchLinks(query);

    const resultPayload = {
      success: true,
      query: { keyword, location, remoteOnly, experienceLevel },
      cached: false,
      retrievedAt: new Date().toISOString(),
      totalJobsFound: uniqueJobs.length,
      providerSummaries,
      jobs: uniqueJobs,
      externalSearchLinks: externalLinks.links
    };

    // Cache the result
    this.cache.set(cacheKey, {
      timestamp: now,
      data: resultPayload
    });

    return resultPayload;
  }

  /**
   * Save an external discovered job into candidate's saved jobs board
   */
  async saveExternalJobToBoard(jobData, userId) {
    if (!userId) {
      throw new Error('Authentication required to save a job to your board.');
    }

    const {
      title,
      company,
      location = 'Remote',
      workMode = 'Remote',
      salaryRange = null,
      description = '',
      requiredSkills = [],
      experienceRequired = '2-4 years',
      source = 'external',
      sourceName = 'External Discovery',
      externalId = null,
      originalUrl = null
    } = jobData;

    if (!title || !company) {
      throw new Error('Job title and company are required.');
    }

    // Check if user has already saved this exact job
    let existing;
    if (externalId && source) {
      existing = await db.query(
        'SELECT id, title, company FROM jobs WHERE user_id = ? AND external_id = ? AND source_name = ?',
        [userId, String(externalId), sourceName]
      );
    } else {
      existing = await db.query(
        'SELECT id, title, company FROM jobs WHERE user_id = ? AND title = ? AND company = ?',
        [userId, title.trim(), company.trim()]
      );
    }

    if (existing && existing.length > 0) {
      return {
        alreadySaved: true,
        jobId: existing[0].id,
        message: `"${title}" at ${company} is already saved in your board.`
      };
    }

    let skillsArray = [];
    if (Array.isArray(requiredSkills)) {
      skillsArray = requiredSkills;
    } else if (typeof requiredSkills === 'string') {
      skillsArray = requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
    }

    const result = await db.query(
      `INSERT INTO jobs 
       (user_id, title, company, location, work_mode, salary_range, description, required_skills, experience_required, status, is_external, external_id, source_name, original_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', TRUE, ?, ?, ?)`,
      [
        userId,
        title.trim(),
        company.trim(),
        (location || 'Remote').trim(),
        workMode || 'Remote',
        salaryRange ? String(salaryRange).trim() : null,
        description ? String(description).trim() : 'External job posting.',
        JSON.stringify(skillsArray),
        (experienceRequired || 'Not specified').trim(),
        externalId ? String(externalId) : null,
        sourceName,
        originalUrl
      ]
    );

    return {
      alreadySaved: false,
      jobId: result.insertId,
      message: `"${title}" at ${company} was successfully added to your CareerPilot Saved Jobs board!`
    };
  }
}

module.exports = new JobAggregatorService();
