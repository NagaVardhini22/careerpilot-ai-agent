/**
 * Google Jobs via SerpApi Provider
 * Requires SERPAPI_API_KEY.
 */

const BaseJobProvider = require('./baseProvider');

class SerpApiProvider extends BaseJobProvider {
  constructor(apiKey = process.env.SERPAPI_API_KEY) {
    super('serpapi', 'Google Jobs via SerpApi');
    this.apiKey = apiKey || '';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async searchJobs(query = {}) {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        displayName: this.displayName,
        status: 'unconfigured',
        count: 0,
        jobs: [],
        message: 'Google Jobs integration requires SERPAPI_API_KEY environment variable.'
      };
    }

    const { keyword = 'software engineer', location = '', remoteOnly = false } = query;
    let q = keyword || 'software engineer';
    if (location) {
      q += ` in ${location}`;
    }
    if (remoteOnly && !q.toLowerCase().includes('remote')) {
      q += ' remote';
    }

    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: q.trim(),
      api_key: this.apiKey,
      hl: 'en'
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    try {
      const res = await this.fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 8000);
      if (!res.ok) {
        return {
          provider: this.name,
          displayName: this.displayName,
          status: 'error',
          count: 0,
          jobs: [],
          error: `SerpApi returned HTTP ${res.status}`
        };
      }

      const data = await res.json();
      const results = (data.jobs_results || []).map((item, idx) => {
        const title = item.title || '';
        const desc = item.description || '';
        const loc = item.location || 'India';
        const skills = this.extractSkills(`${title} ${desc}`);

        let applyLink = null;
        if (item.apply_options && item.apply_options.length > 0) {
          applyLink = item.apply_options[0].link;
        } else if (item.related_links && item.related_links.length > 0) {
          applyLink = item.related_links[0].link;
        }

        return this.normalizeJob({
          externalId: item.job_id || `serp_${idx}_${Date.now()}`,
          title,
          company: item.company_name || 'Employer',
          location: loc,
          workMode: (loc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote')) ? 'Remote' : 'On-site',
          description: desc,
          requiredSkills: skills,
          salaryRange: item.detected_extensions?.salary || null,
          originalUrl: applyLink || 'https://google.com/search?q=' + encodeURIComponent(q),
          postedAt: item.detected_extensions?.posted_at || null
        });
      });

      return {
        provider: this.name,
        displayName: this.displayName,
        status: 'live',
        count: results.length,
        jobs: results
      };
    } catch (err) {
      return {
        provider: this.name,
        displayName: this.displayName,
        status: 'error',
        count: 0,
        jobs: [],
        error: err.message
      };
    }
  }
}

module.exports = SerpApiProvider;
