/**
 * Jooble Job Search API Provider
 * Requires JOOBLE_API_KEY.
 */

const BaseJobProvider = require('./baseProvider');

class JoobleProvider extends BaseJobProvider {
  constructor(apiKey = process.env.JOOBLE_API_KEY) {
    super('jooble', 'Jooble Job Search');
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
        message: 'Jooble requires JOOBLE_API_KEY environment variable.'
      };
    }

    const { keyword = 'developer', location = '', remoteOnly = false } = query;
    let keywords = keyword || 'software engineer';
    if (remoteOnly && !keywords.toLowerCase().includes('remote')) {
      keywords += ' remote';
    }

    const url = `https://jooble.org/api/${encodeURIComponent(this.apiKey)}`;
    const payload = {
      keywords: keywords.trim(),
      location: location ? location.trim() : ''
    };

    try {
      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 7000);

      if (!res.ok) {
        return {
          provider: this.name,
          displayName: this.displayName,
          status: 'error',
          count: 0,
          jobs: [],
          error: `Jooble API returned HTTP ${res.status}`
        };
      }

      const data = await res.json();
      const results = (data.jobs || []).map(item => {
        const title = item.title || '';
        const desc = item.snippet || '';
        const loc = item.location || 'India';
        const skills = this.extractSkills(`${title} ${desc}`);

        return this.normalizeJob({
          externalId: item.id,
          title,
          company: item.company || 'Hiring Company',
          location: loc,
          workMode: (loc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote')) ? 'Remote' : 'On-site',
          salaryRange: item.salary || null,
          description: desc,
          requiredSkills: skills,
          originalUrl: item.link,
          postedAt: item.updated || null
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

module.exports = JoobleProvider;
