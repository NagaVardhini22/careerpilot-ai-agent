/**
 * CareerPilot — API Client
 * Vanilla JavaScript REST API wrapper with CSRF headers and HTTP-only cookie support.
 */

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // CSRF protection header required for mutating cookie requests
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        credentials: 'same-origin', // Send HTTP-only session cookies
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.error || `Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.status !== 401) {
        console.error(`[API Error] ${endpoint}:`, error.message);
      }
      throw error;
    }
  },

  // Authentication
  register(nameOrObj, email, password) {
    let payload;
    if (typeof nameOrObj === 'object' && nameOrObj !== null) {
      payload = {
        name: nameOrObj.name || nameOrObj.fullName || nameOrObj.username,
        email: nameOrObj.email,
        password: nameOrObj.password
      };
    } else {
      payload = {
        name: nameOrObj,
        email: email,
        password: password
      };
    }

    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  login(emailOrObj, password) {
    let payload;
    if (typeof emailOrObj === 'object' && emailOrObj !== null) {
      payload = {
        email: emailOrObj.email,
        password: emailOrObj.password
      };
    } else {
      payload = {
        email: emailOrObj,
        password: password
      };
    }

    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  logout() {
    return this.request('/auth/logout', {
      method: 'POST'
    });
  },

  getCurrentUser() {
    return this.request('/auth/me');
  },

  // Health
  getHealth() {
    return this.request('/health');
  },

  // Dashboard Stats
  getStats() {
    return this.request('/stats');
  },

  // Profile & Skills
  getProfile(candidateId = null) {
    const q = candidateId ? `?candidateId=${candidateId}` : '';
    return this.request(`/profile${q}`);
  },

  createProfile(profileData) {
    return this.request('/profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  },

  updateProfile(candidateId, profileData) {
    return this.request(`/profile/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  getSkillsCatalog() {
    return this.request('/profile/skills');
  },

  // Jobs Board
  getJobs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.keyword) params.append('keyword', filters.keyword);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/jobs${q}`);
  },

  getJobById(jobId) {
    return this.request(`/jobs/${jobId}`);
  },

  createJob(jobData) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  },

  deleteJob(jobId) {
    return this.request(`/jobs/${jobId}`, {
      method: 'DELETE'
    });
  },

  analyzeJob(jobId, candidateId = null) {
    return this.request(`/jobs/${jobId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ candidateId })
    });
  },

  // External Live Job Discovery
  searchLiveJobs(query = {}) {
    const params = new URLSearchParams();
    if (query.keyword) params.append('keyword', query.keyword);
    if (query.location) params.append('location', query.location);
    if (query.remoteOnly) params.append('remoteOnly', 'true');
    if (query.experienceLevel) params.append('experienceLevel', query.experienceLevel);
    if (query.provider && query.provider !== 'all') params.append('provider', query.provider);
    return this.request(`/jobs/external/search?${params.toString()}`);
  },

  getJobProviders() {
    return this.request('/jobs/external/providers');
  },

  saveExternalJob(jobData) {
    return this.request('/jobs/external/save', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  },

  // Analyses & Applications
  getAnalyses(candidateId = null) {
    const q = candidateId ? `?candidateId=${candidateId}` : '';
    return this.request(`/analyses${q}`);
  },

  getAnalysisById(id) {
    return this.request(`/analyses/${id}`);
  },

  getApplications(candidateId = null) {
    const q = candidateId ? `?candidateId=${candidateId}` : '';
    return this.request(`/applications${q}`);
  },

  // AI Agent
  runAgent(userRequest, candidateId = null) {
    return this.request('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ request: userRequest, candidateId })
    });
  },

  getAgentRuns(limit = 20) {
    return this.request(`/agent/runs?limit=${limit}`);
  },

  getAgentRunById(runId) {
    return this.request(`/agent/runs/${runId}`);
  },

  // Demo / Dev Controls
  seedDemo() {
    return this.request('/demo/seed', { method: 'POST' });
  },

  resetDb() {
    return this.request('/demo/reset', { method: 'POST' });
  }
};
