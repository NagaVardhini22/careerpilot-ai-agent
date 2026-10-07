/**
 * CareerPilot — API Client
 * Vanilla JavaScript REST API wrapper.
 */

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    }
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

  // Jobs
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
  runAgent(userRequest, userId = 1, candidateId = null) {
    return this.request('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ request: userRequest, userId, candidateId })
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
