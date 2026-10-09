/**
 * External Search Link Provider
 * Generates verified, authorized direct search links for LinkedIn, Naukri, and Foundit.
 * Adheres strictly to terms of service: no illegal scraping, no CAPTCHA circumvention.
 */

class ExternalSearchLinkProvider {
  constructor() {
    this.name = 'external_links';
    this.displayName = 'Direct Portal Search Links';
  }

  isConfigured() {
    return true;
  }

  generateSearchLinks(query = {}) {
    const { keyword = 'Software Engineer', location = 'India', remoteOnly = false, experienceLevel = '' } = query;
    const term = (keyword || 'Software Engineer').trim();
    const loc = (location || 'India').trim();

    const links = [];

    // 1. LinkedIn Jobs Search Link
    let linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(term)}&location=${encodeURIComponent(loc)}`;
    if (remoteOnly) {
      linkedInUrl += '&f_WT=2'; // LinkedIn Remote filter flag
    }
    links.push({
      id: 'ext_linkedin',
      portal: 'LinkedIn Jobs',
      title: `Search "${term}" on LinkedIn`,
      url: linkedInUrl,
      sourceType: 'external_link',
      description: `Open live, authentic search results for "${term}" in ${loc} on LinkedIn.`,
      tags: ['Verified Official Portal', remoteOnly ? 'Remote' : 'All Work Modes']
    });

    // 2. Naukri Jobs Search Link
    let naukriSlug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let naukriLocSlug = loc.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let naukriUrl = `https://www.naukri.com/${encodeURIComponent(naukriSlug)}-jobs-in-${encodeURIComponent(naukriLocSlug)}?k=${encodeURIComponent(term)}`;
    if (experienceLevel) {
      naukriUrl += `&experience=${encodeURIComponent(experienceLevel)}`;
    }
    links.push({
      id: 'ext_naukri',
      portal: 'Naukri.com',
      title: `Search "${term}" on Naukri`,
      url: naukriUrl,
      sourceType: 'external_link',
      description: `Explore live job openings for "${term}" in ${loc} directly on India's premier job portal Naukri.com.`,
      tags: ['Verified Official Portal', 'Top India Portal']
    });

    // 3. Foundit (formerly Monster India) Search Link
    let founditUrl = `https://www.foundit.in/srp/results?query=${encodeURIComponent(term)}&locations=${encodeURIComponent(loc)}`;
    links.push({
      id: 'ext_foundit',
      portal: 'Foundit (Monster India)',
      title: `Search "${term}" on Foundit`,
      url: founditUrl,
      sourceType: 'external_link',
      description: `View verified candidate listings for "${term}" on Foundit India.`,
      tags: ['Verified Official Portal']
    });

    return {
      provider: this.name,
      displayName: this.displayName,
      status: 'external_link',
      count: links.length,
      links
    };
  }
}

module.exports = ExternalSearchLinkProvider;
