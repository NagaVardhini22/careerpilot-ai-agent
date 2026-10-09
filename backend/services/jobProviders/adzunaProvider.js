/**
 * Adzuna Job Search API Provider
 * Requires ADZUNA_APP_ID and ADZUNA_APP_KEY.
 */

const BaseJobProvider = require('./baseProvider');

class AdzunaProvider extends BaseJobProvider {
  constructor(appId = process.env.ADZUNA_APP_ID, appKey = process.env.ADZUNA_APP_KEY, country = 'in') {
    super('adzuna', 'Adzuna Jobs');
    this.appId = appId || '';
    this.appKey = appKey || '';
    this.country = country;
  }

  isConfigured() {
    return Boolean(this.appId && this.appKey);
  }

  async searchJobs(query = {}) {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        displayName: this.displayName,
        status: 'unconfigured',
        count: 0,
        jobs: [],
        message: 'Adzuna requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.'
      };
    }

    const { keyword = 'developer', location = '', remoteOnly = false } = query;
    const country = query.country || this.country || 'in';

    let what = keyword || 'software engineer';
    if (remoteOnly && !what.toLowerCase().includes('remote')) {
      what += ' remote';
    }

    const params = new URLSearchParams({
      app_id: this.appId,
      app_key: this.appKey,
      results_per_page: '15',
      what: what.trim()
    });

    if (location) {
      params.append('where', location.trim());
    }

    const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1?${params.toString()}`;

    try {
      const res = await this.fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 7000);
      if (!res.ok) {
        return {
          provider: this.name,
          displayName: this.displayName,
          status: 'error',
          count: 0,
          jobs: [],
          error: `Adzuna API returned HTTP ${res.status}`
        };
      }

      const data = await res.json();
      const results = (data.results || []).map(item => {
        const title = item.title || '';
        const desc = item.description || '';
        const loc = item.location?.display_name || 'India';
        const skills = this.extractSkills(`${title} ${desc}`);

        let salary = null;
        if (item.salary_min && item.salary_max) {
          salary = `₹${Math.round(item.salary_min)} - ₹${Math.round(item.salary_max)}`;
        }

        return this.normalizeJob({
          externalId: item.id,
          title,
          company: item.company?.display_name || 'Tech Employer',
          location: loc,
          workMode: (loc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote')) ? 'Remote' : 'On-site',
          description: desc,
          requiredSkills: skills,
          salaryRange: salary,
          originalUrl: item.redirect_url,
          postedAt: item.created
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

module.exports = AdzunaProvider;
