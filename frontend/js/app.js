/**
 * CareerPilot — Main Application Controller
 * Coordinates API calls, tab switching, event listeners, auth state, and data lifecycle.
 */

const App = {
  async init() {
    console.log('🚀 Initializing CareerPilot Application...');

    // 1. Initialize Event Listeners
    this.bindEvents();

    // 2. Initialize Agent Module
    Agent.init();

    // 3. Load App Data
    await this.refreshApp();
  },

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        UI.switchTab(tab);
      });
    });

    // In-page navigation buttons
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav');
        UI.switchTab(target);
      });
    });

    // Onboarding Button
    const onboardBtn = document.getElementById('btn-start-onboarding');
    if (onboardBtn) {
      onboardBtn.addEventListener('click', () => UI.switchTab('profile'));
    }

    // Auth Buttons & Form Controls
    const openAuthBtn = document.getElementById('btn-open-auth-modal');
    if (openAuthBtn) {
      openAuthBtn.addEventListener('click', () => UI.openAuthModal('login'));
    }

    const closeAuthBtn = document.getElementById('btn-close-auth-modal');
    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', () => UI.closeAuthModal());
    }

    const tabAuthLogin = document.getElementById('tab-auth-login');
    if (tabAuthLogin) {
      tabAuthLogin.addEventListener('click', () => UI.switchAuthTab('login'));
    }

    const tabAuthRegister = document.getElementById('tab-auth-register');
    if (tabAuthRegister) {
      tabAuthRegister.addEventListener('click', () => UI.switchAuthTab('register'));
    }

    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }

    const registerForm = document.getElementById('form-register');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister();
      });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Quick Add Job
    const quickAddBtn = document.getElementById('btn-quick-add-job');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => UI.openAddJobModal());
    }

    const openAddJobBtn = document.getElementById('btn-open-add-job-modal');
    if (openAddJobBtn) {
      openAddJobBtn.addEventListener('click', () => UI.openAddJobModal());
    }

    // Modal Close Buttons
    const closeJobModalBtn = document.getElementById('btn-close-job-modal');
    if (closeJobModalBtn) closeJobModalBtn.addEventListener('click', () => UI.closeAddJobModal());

    const cancelJobModalBtn = document.getElementById('btn-cancel-job-modal');
    if (cancelJobModalBtn) cancelJobModalBtn.addEventListener('click', () => UI.closeAddJobModal());

    const closeRunModalBtn = document.getElementById('btn-close-run-modal');
    if (closeRunModalBtn) {
      closeRunModalBtn.addEventListener('click', () => {
        const m = document.getElementById('modal-run-detail');
        if (m) m.close();
      });
    }

    // Add Job Form Submit
    const jobForm = document.getElementById('form-add-job');
    if (jobForm) {
      jobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateJob();
      });
    }

    // Search and Status Filters for Jobs
    const searchInput = document.getElementById('jobs-search-input');
    const statusFilter = document.getElementById('jobs-status-filter');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => this.filterJobs(), 300));
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.filterJobs());
    }

    // Live Job Search
    const searchLiveBtn = document.getElementById('btn-search-live-jobs');
    if (searchLiveBtn) {
      searchLiveBtn.addEventListener('click', () => this.handleSearchLiveJobs());
    }
    const liveKeywordInput = document.getElementById('live-search-keyword');
    const liveLocationInput = document.getElementById('live-search-location');
    [liveKeywordInput, liveLocationInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleSearchLiveJobs();
          }
        });
      }
    });

    // Interview Prep Job Select Dropdown
    const prepSelect = document.getElementById('interview-job-select');
    if (prepSelect) {
      prepSelect.addEventListener('change', async (e) => {
        const jobId = e.target.value;
        if (!jobId) {
          UI.renderInterviewPrep(null);
          return;
        }
        await this.loadInterviewPrepForJob(jobId);
      });
    }

    // Demo Data & Clean Reset Buttons
    const loadDemoBtn = document.getElementById('btn-load-demo');
    if (loadDemoBtn) {
      loadDemoBtn.addEventListener('click', () => this.handleLoadDemo());
    }

    const resetDbBtn = document.getElementById('btn-reset-db');
    if (resetDbBtn) {
      resetDbBtn.addEventListener('click', () => this.handleResetDb());
    }
  },

  async refreshApp() {
    try {
      // 1. Health check & provider status
      const health = await API.getHealth();
      const modeEl = document.getElementById('agent-mode-label');
      const tagEl = document.getElementById('agent-provider-tag');
      if (modeEl) modeEl.textContent = `Provider: ${health.aiProvider.toUpperCase()}`;
      if (tagEl) tagEl.textContent = `Provider: ${health.aiProvider.toUpperCase()}`;

      // 2. Auth check
      let currentUser = null;
      try {
        const userRes = await API.getCurrentUser();
        currentUser = userRes.user;
      } catch (err) {
        currentUser = null;
      }
      UI.updateAuthUI(currentUser);

      // 3. Load active candidate profile
      try {
        const profileRes = await API.getProfile();
        UI.updateHeaderProfile(profileRes.profile);
        UI.renderProfileView(profileRes.profile);
      } catch (err) {
        UI.updateHeaderProfile(null);
        UI.renderProfileView(null);
      }

      // 4. Load stats & recent runs
      const statsRes = await API.getStats();
      UI.renderDashboard(statsRes.stats, statsRes.stats.recentRuns);

      // 5. Load jobs
      const jobsRes = await API.getJobs();
      UI.renderJobs(jobsRes.jobs);

      // 6. Load analyses
      const analysesRes = await API.getAnalyses();
      UI.renderAnalyses(analysesRes.analyses);

      // 7. Load agent runs
      const runsRes = await API.getAgentRuns();
      UI.renderAgentHistory(runsRes.runs);

      // 8. Load live job providers
      try {
        const provRes = await API.getJobProviders();
        UI.renderLiveJobProviders(provRes.providers);
      } catch (provErr) {
        console.warn('Live job providers status unavailable:', provErr.message);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
      UI.showToast(`Data load issue: ${err.message}`, 'error');
    }
  },

  async refreshSilent() {
    try {
      const statsRes = await API.getStats();
      UI.renderDashboard(statsRes.stats, statsRes.stats.recentRuns);

      const jobsRes = await API.getJobs();
      UI.renderJobs(jobsRes.jobs);

      const analysesRes = await API.getAnalyses();
      UI.renderAnalyses(analysesRes.analyses);

      const runsRes = await API.getAgentRuns();
      UI.renderAgentHistory(runsRes.runs);
    } catch (err) {
      console.warn('Silent refresh issue:', err.message);
    }
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      UI.clearAuthError();
      const res = await API.login(email, password);
      UI.showToast(`Welcome back, ${res.user.name}!`, 'success');
      UI.closeAuthModal();
      document.getElementById('form-login').reset();
      await this.refreshApp();
    } catch (err) {
      UI.setAuthError(err.message);
    }
  },

  async handleRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('reg-email') ? document.getElementById('reg-email').value.trim() : document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    try {
      UI.clearAuthError();
      const res = await API.register(name, email, password);
      UI.showToast(`Account created for ${res.user.name}!`, 'success');
      UI.closeAuthModal();
      document.getElementById('form-register').reset();
      await this.refreshApp();
      UI.switchTab('profile');
    } catch (err) {
      UI.setAuthError(err.message);
    }
  },

  async handleLogout() {
    try {
      await API.logout();
      UI.showToast('Logged out successfully.', 'info');
      await this.refreshApp();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async handleCreateJob() {
    const title = document.getElementById('job-title').value;
    const company = document.getElementById('job-company').value;
    const location = document.getElementById('job-location').value;
    const workMode = document.getElementById('job-work-mode').value;
    const salaryRange = document.getElementById('job-salary').value;
    const experienceRequired = document.getElementById('job-experience').value;
    const skillsRaw = document.getElementById('job-required-skills').value;
    const description = document.getElementById('job-description').value;

    const payload = {
      title,
      company,
      location,
      workMode,
      salaryRange,
      experienceRequired,
      requiredSkills: skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
      description
    };

    try {
      await API.createJob(payload);
      UI.showToast(`Job "${title}" saved successfully!`, 'success');
      UI.closeAddJobModal();
      document.getElementById('form-add-job').reset();
      await this.refreshApp();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async handleDeleteJob(jobId) {
    if (!confirm('Are you sure you want to remove this job listing?')) return;
    try {
      await API.deleteJob(jobId);
      UI.showToast('Job removed from repository.', 'info');
      await this.refreshApp();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  // Aliases for UI calls
  deleteJob(jobId) {
    return this.handleDeleteJob(jobId);
  },

  async filterJobs() {
    const keyword = document.getElementById('jobs-search-input').value;
    const status = document.getElementById('jobs-status-filter').value;
    try {
      const res = await API.getJobs({ keyword, status });
      UI.renderJobs(res.jobs);
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async triggerJobAnalysis(jobId) {
    try {
      UI.showToast('Analyzing candidate-job compatibility...', 'info');
      const res = await API.analyzeJob(jobId);
      UI.showToast(`Analysis complete: ${res.analysis.matchScore}% Match!`, 'success');
      await this.refreshApp();
      UI.switchTab('analyses');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  analyzeJob(jobId) {
    return this.triggerJobAnalysis(jobId);
  },

  prepareInterviewForJob(jobId) {
    UI.switchTab('interviews');
    const select = document.getElementById('interview-job-select');
    if (select) select.value = jobId;
    return this.loadInterviewPrepForJob(jobId);
  },

  triggerInterviewPrepForJob(jobId, jobTitle) {
    UI.switchTab('agent');
    const prompt = `Prepare comprehensive interview questions for Job #${jobId}: ${jobTitle}`;
    const textarea = document.getElementById('agent-prompt-input');
    if (textarea) textarea.value = prompt;
    Agent.executePrompt(prompt);
  },

  async loadInterviewPrepForJob(jobId) {
    try {
      const job = await API.getJobById(jobId);
      if (!job || !job.job) return;

      const profile = UI.state.activeProfile;
      const matched = [];
      const missing = [];
      const candSkills = profile && profile.skills ? profile.skills.map(s => s.name.toLowerCase()) : [];

      job.job.requiredSkills.forEach(skill => {
        if (candSkills.includes(skill.toLowerCase())) matched.push(skill);
        else missing.push(skill);
      });

      const prepData = {
        jobTitle: job.job.title,
        company: job.job.company,
        technicalQuestions: [
          {
            skill: matched[0] || 'Core Stack Architecture',
            question: `How would you architect a high-reliability service using ${matched.slice(0, 2).join(' & ') || 'modern web patterns'}?`,
            talkingPoints: 'Discuss modular controller layers, error handling, connection pooling, and non-blocking I/O.'
          },
          {
            skill: 'Database Design & Relational Modeling',
            question: 'How do you design normalized MySQL schemas and optimize slow queries using execution plans?',
            talkingPoints: 'Highlight indexing strategies, foreign keys, transaction isolation, and query refactoring.'
          }
        ],
        behavioralQuestions: [
          {
            topic: 'Engineering Tradeoffs',
            question: `Describe a situation where you had to balance feature delivery speed against code refactoring. How did you decide?`,
            starFramework: 'Situation, Task, Action, Result. Emphasize data-driven consensus and risk mitigation.'
          }
        ],
        skillGapQuestions: missing.map(s => ({
          gapSkill: s,
          question: `The job mentions experience with ${s}. How would you ramp up and apply your core foundation?`,
          strategy: 'Connect to analogous concepts in your stack and highlight self-directed learning speed.'
        })),
        candidateTips: [
          `Research ${job.job.company}'s engineering blog and mention relevant architectural challenges.`,
          `Frame your answers with measurable metrics (latency reduction, maintainability).`
        ]
      };

      UI.renderInterviewPrep(prepData);
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  // Live Job Search Handler
  async handleSearchLiveJobs() {
    const keyword = document.getElementById('live-search-keyword')?.value.trim() || '';
    const location = document.getElementById('live-search-location')?.value.trim() || '';
    const remoteOnly = document.getElementById('live-search-remote')?.checked || false;
    const provider = document.getElementById('live-search-provider')?.value || 'all';

    const searchBtn = document.getElementById('btn-search-live-jobs');
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.innerHTML = '<span class="spinner-small" style="margin-right:6px;"></span> Searching...';
    }

    try {
      UI.showToast('Discovering live openings across connected career boards...', 'info');
      const res = await API.searchLiveJobs({ keyword, location, remoteOnly, provider });
      UI.renderLiveJobs(res);
      const count = res.count || (res.jobs ? res.jobs.length : 0);
      UI.showToast(`Discovered ${count} live opportunities!`, 'success');
    } catch (err) {
      UI.showToast(`Job search error: ${err.message}`, 'error');
    } finally {
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Search Live Jobs';
      }
    }
  },

  // Save Discovered External Job to Repository
  async handleSaveExternalJob(jobData) {
    try {
      UI.showToast(`Saving "${jobData.title}" to your jobs board...`, 'info');
      await API.saveExternalJob(jobData);
      UI.showToast(`"${jobData.title}" saved to repository!`, 'success');
      const jobsRes = await API.getJobs();
      UI.renderJobs(jobsRes.jobs);
      const statsRes = await API.getStats();
      UI.renderDashboard(statsRes.stats, statsRes.stats.recentRuns);
    } catch (err) {
      UI.showToast(`Failed to save job: ${err.message}`, 'error');
    }
  },

  async viewRunDetail(runId) {
    try {
      const res = await API.getAgentRunById(runId);
      const run = res.run;
      const modal = document.getElementById('modal-run-detail');
      const content = document.getElementById('run-detail-content');
      document.getElementById('run-detail-title').textContent = `Agent Run #${run.id} Details`;

      const toolCalls = run.toolCalls || [];

      content.innerHTML = `
        <div style="background-color:#101726; padding:16px; border-radius:10px; margin-bottom:20px; border:1px solid #23304c;">
          <div style="font-size:0.9rem; font-weight:700; color:#fff; margin-bottom:4px;">Request: "${escapeHtml(run.user_request)}"</div>
          <div style="font-size:0.75rem; color:#94a3b8; display:flex; gap:16px;">
            <span>Status: <strong style="color:${run.status === 'completed' ? '#34d399' : '#f87171'}">${run.status}</strong></span>
            <span>Iterations: <strong>${run.total_iterations}</strong></span>
            <span>Total Duration: <strong>${run.duration_ms}ms</strong></span>
            <span>Date: <strong>${new Date(run.created_at).toLocaleString()}</strong></span>
          </div>
        </div>

        <h4 style="font-size:0.9rem; font-weight:700; color:#fff; margin-bottom:12px;">Tool Execution Audit (${toolCalls.length} Calls)</h4>

        ${toolCalls.length === 0 ? '<p class="empty-text">No backend tools called during this run.</p>' : ''}

        <div style="display:flex; flex-direction:column; gap:12px;">
          ${toolCalls.map((tc, idx) => `
            <div style="background-color:#101726; border:1px solid #23304c; border-radius:8px; padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:monospace; font-size:0.85rem; color:#818cf8; font-weight:700;">
                  ${idx + 1}. ${escapeHtml(tc.toolName)}
                </span>
                <span style="font-size:0.72rem; color:#94a3b8;">${tc.executionTimeMs}ms • <strong style="color:#34d399">${tc.status}</strong></span>
              </div>
              
              <div style="margin-bottom:6px;">
                <span style="font-size:0.72rem; color:#64748b; text-transform:uppercase; font-weight:600;">Arguments:</span>
                <pre style="background-color:#0a0e17; padding:8px; border-radius:6px; font-size:0.72rem; color:#cbd5e1; overflow-x:auto;">${escapeHtml(JSON.stringify(tc.arguments, null, 2))}</pre>
              </div>

              <div>
                <span style="font-size:0.72rem; color:#64748b; text-transform:uppercase; font-weight:600;">Result Payload:</span>
                <pre style="background-color:#0a0e17; padding:8px; border-radius:6px; font-size:0.72rem; color:#cbd5e1; overflow-x:auto; max-height:160px;">${escapeHtml(JSON.stringify(tc.result, null, 2))}</pre>
              </div>
            </div>
          `).join('')}
        </div>

        ${run.final_response ? `
          <div style="margin-top:20px;">
            <h4 style="font-size:0.9rem; font-weight:700; color:#fff; margin-bottom:8px;">Final Agent Markdown Response</h4>
            <div style="background-color:#101726; padding:16px; border-radius:8px; border:1px solid #23304c; font-size:0.85rem; color:#cbd5e1; line-height:1.6;">
              ${Agent.renderMarkdown(run.final_response)}
            </div>
          </div>
        ` : ''}
      `;

      modal.showModal();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async handleLoadDemo() {
    if (!confirm('Populate realistic sample candidate profile, 6 saved jobs, and demo records for interview demonstration?')) return;
    try {
      UI.showToast('Seeding demo data into MySQL...', 'info');
      await API.seedDemo();
      UI.showToast('Demo data loaded successfully!', 'success');
      await this.refreshApp();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async handleResetDb() {
    if (!confirm('Reset application to clean empty state? All profiles, jobs, and runs will be cleared.')) return;
    try {
      UI.showToast('Resetting database...', 'info');
      await API.resetDb();
      UI.showToast('Database reset to clean empty state!', 'info');
      await this.refreshApp();
      UI.switchTab('dashboard');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }
};

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
