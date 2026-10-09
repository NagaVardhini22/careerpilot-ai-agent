/**
 * Official Lever Public Postings Provider
 * Fetches live job postings from configured company Lever career sites without API keys.
 */

const BaseJobProvider = require('./baseProvider');

class LeverProvider extends BaseJobProvider {
  constructor(configuredSites = ['spotify', 'netflix']) {
    super('lever', 'Lever Public Postings');
    this.sites = Array.isArray(configuredSites) && configuredSites.length > 0
      ? configuredSites
      : ['spotify', 'netflix'];
  }

  isConfigured() {
    return this.sites.length > 0;
  }

  async searchJobs(query = {}) {
    const { keyword = '', location = '', remoteOnly = false } = query;
    const lowerKeyword = keyword.toLowerCase().trim();
    const lowerLocation = location.toLowerCase().trim();

    const results = [];
    const errors = [];

    for (const site of this.sites) {
      try {
        const url = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
        const res = await this.fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 6000);

        if (!res.ok) {
          if (res.status === 404) continue;
          errors.push(`Site "${site}": HTTP ${res.status}`);
          continue;
        }

        const postings = await res.json();
        if (!Array.isArray(postings)) continue;

        for (const p of postings) {
          const title = p.text || '';
          const jobLoc = p.categories?.location || '';
          const workplaceType = p.workplaceType || '';
          const desc = p.descriptionPlain || '';

          if (lowerKeyword) {
            const matchesTitle = title.toLowerCase().includes(lowerKeyword);
            const matchesDesc = desc.toLowerCase().includes(lowerKeyword);
            if (!matchesTitle && !matchesDesc) continue;
          }

          if (lowerLocation && !jobLoc.toLowerCase().includes(lowerLocation)) {
            continue;
          }

          const isRemote = jobLoc.toLowerCase().includes('remote') ||
                           workplaceType.toLowerCase().includes('remote') ||
                           title.toLowerCase().includes('remote');
          if (remoteOnly && !isRemote) {
            continue;
          }

          const skills = this.extractSkills(`${title} ${desc}`);
          const companyName = site.charAt(0).toUpperCase() + site.slice(1);

          results.push(this.normalizeJob({
            externalId: p.id,
            title,
            company: companyName,
            location: jobLoc || (isRemote ? 'Remote' : 'Various'),
            workMode: isRemote ? 'Remote' : (workplaceType === 'hybrid' ? 'Hybrid' : 'On-site'),
            employmentType: p.categories?.commitment || 'Full-time',
            description: desc,
            requiredSkills: skills,
            originalUrl: p.hostedUrl,
            postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null
          }));
        }
      } catch (err) {
        errors.push(`Site "${site}": ${err.message}`);
      }
    }

    return {
      provider: this.name,
      displayName: this.displayName,
      status: results.length > 0 ? 'live' : (errors.length > 0 ? 'error' : 'live'),
      count: results.length,
      jobs: results,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

module.exports = LeverProvider;
