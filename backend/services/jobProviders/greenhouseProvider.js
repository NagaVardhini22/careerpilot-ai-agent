/**
 * Official Greenhouse Public Board Provider
 * Fetches live job postings from configured company Greenhouse boards without API keys.
 */

const BaseJobProvider = require('./baseProvider');

class GreenhouseProvider extends BaseJobProvider {
  constructor(configuredBoards = ['github', 'cloudflare', 'stripe']) {
    super('greenhouse', 'Greenhouse Public Boards');
    this.boards = Array.isArray(configuredBoards) && configuredBoards.length > 0
      ? configuredBoards
      : ['github', 'cloudflare', 'stripe'];
  }

  isConfigured() {
    return this.boards.length > 0;
  }

  async searchJobs(query = {}) {
    const { keyword = '', location = '', remoteOnly = false } = query;
    const lowerKeyword = keyword.toLowerCase().trim();
    const lowerLocation = location.toLowerCase().trim();

    const results = [];
    const errors = [];

    for (const board of this.boards) {
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
        const res = await this.fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 6000);

        if (!res.ok) {
          if (res.status === 404) continue; // Board token not active
          errors.push(`Board "${board}": HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const jobs = data.jobs || [];

        for (const j of jobs) {
          const title = j.title || '';
          const jobLoc = j.location?.name || '';
          const content = j.content || '';

          // Filter by keyword if provided
          if (lowerKeyword) {
            const matchesTitle = title.toLowerCase().includes(lowerKeyword);
            const matchesContent = content.toLowerCase().includes(lowerKeyword);
            if (!matchesTitle && !matchesContent) continue;
          }

          // Filter by location if provided
          if (lowerLocation && !jobLoc.toLowerCase().includes(lowerLocation)) {
            continue;
          }

          // Filter by remoteOnly
          const isRemote = jobLoc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote');
          if (remoteOnly && !isRemote) {
            continue;
          }

          const skills = this.extractSkills(`${title} ${content}`);
          const companyName = board.charAt(0).toUpperCase() + board.slice(1);

          results.push(this.normalizeJob({
            externalId: j.id,
            title,
            company: companyName,
            location: jobLoc || 'Remote',
            workMode: isRemote ? 'Remote' : 'On-site',
            description: content,
            requiredSkills: skills,
            originalUrl: j.absolute_url,
            postedAt: j.updated_at
          }));
        }
      } catch (err) {
        errors.push(`Board "${board}": ${err.message}`);
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

module.exports = GreenhouseProvider;
