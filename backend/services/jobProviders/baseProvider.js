/**
 * Base Job Provider Interface
 * Provides shared normalization, timeouts, and error handling.
 */

class BaseJobProvider {
  constructor(name, displayName) {
    this.name = name;
    this.displayName = displayName;
  }

  /**
   * Whether provider is configured with required secrets / boards
   */
  isConfigured() {
    return true;
  }

  /**
   * Helper to perform HTTP fetch with a timeout
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${this.displayName} timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  /**
   * Search jobs from provider
   * @param {Object} query - { keyword, location, remoteOnly, experienceLevel, skills }
   * @returns {Promise<{ provider: string, status: string, jobs: Array, error?: string }>}
   */
  async searchJobs(query) {
    throw new Error('searchJobs must be implemented by subclass.');
  }

  /**
   * Extract skills mentioned in text/title
   */
  extractSkills(text, knownSkills = []) {
    if (!text || typeof text !== 'string') return [];
    const lower = text.toLowerCase();
    const defaults = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
      'React', 'Node.js', 'Express', 'Angular', 'Vue', 'Next.js',
      'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git',
      'Linux', 'GraphQL', 'REST', 'Tailwind', 'HTML', 'CSS'
    ];
    const candidateList = knownSkills.length > 0 ? knownSkills : defaults;
    const found = [];
    for (const skill of candidateList) {
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i');
      if (regex.test(lower) || lower.includes(skill.toLowerCase())) {
        if (!found.includes(skill)) {
          found.push(skill);
        }
      }
    }
    return found;
  }

  /**
   * Standardize job object into uniform CareerPilot format
   */
  normalizeJob({
    externalId,
    title,
    company,
    location = 'Remote',
    workMode = 'Remote',
    employmentType = 'Full-time',
    description = '',
    requiredSkills = [],
    salaryRange = null,
    experienceRequired = null,
    originalUrl,
    postedAt = null
  }) {
    let mode = workMode;
    const locLower = (location || '').toLowerCase();
    if (locLower.includes('remote')) {
      mode = 'Remote';
    } else if (locLower.includes('hybrid')) {
      mode = 'Hybrid';
    } else if (mode !== 'Remote' && mode !== 'Hybrid') {
      mode = 'On-site';
    }

    return {
      id: `${this.name}_${externalId}`,
      externalId: String(externalId),
      source: this.name,
      sourceName: this.displayName,
      title: (title || 'Software Opportunity').trim(),
      company: (company || 'Confidential').trim(),
      location: (location || 'Remote').trim(),
      workMode: mode,
      employmentType: employmentType || 'Full-time',
      salaryRange: salaryRange || null,
      experienceRequired: experienceRequired || 'Not specified',
      description: description ? description.replace(/<[^>]*>?/gm, ' ').substring(0, 800).trim() : '',
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      originalUrl,
      postedAt: postedAt || new Date().toISOString(),
      sourceType: 'live'
    };
  }
}

module.exports = BaseJobProvider;
