/**
 * CareerPilot — UI Rendering & State Management
 * Vanilla JavaScript DOM manipulators.
 */

const UI = {
  // Global State
  state: {
    activeProfile: null,
    jobs: [],
    analyses: [],
    stats: null,
    activeTab: 'dashboard'
  },

  // Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Update Header User Pill
  updateHeaderProfile(profile) {
    this.state.activeProfile = profile;
    const nameEl = document.getElementById('header-user-name');
    const headlineEl = document.getElementById('header-user-headline');
    const avatarEl = document.getElementById('header-avatar');
    const onboardingBanner = document.getElementById('onboarding-banner');
    const contextEl = document.getElementById('agent-context-profile');

    if (profile) {
      nameEl.textContent = profile.name;
      headlineEl.textContent = profile.headline || 'Active Candidate';
      avatarEl.textContent = (profile.name || 'U').charAt(0).toUpperCase();
      if (onboardingBanner) onboardingBanner.classList.add('hidden');

      if (contextEl) {
        contextEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:700; color:#fff;">${profile.name}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">${profile.headline}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">Experience: <strong>${profile.experienceYears} yrs</strong></div>
            <div style="font-size:0.75rem; color:#94a3b8;">Skills: <strong>${profile.skills ? profile.skills.length : 0} cataloged</strong></div>
          </div>
        `;
      }
    } else {
      nameEl.textContent = 'Guest Candidate';
      headlineEl.textContent = 'No profile created';
      avatarEl.textContent = '?';
      if (onboardingBanner) onboardingBanner.classList.remove('hidden');

      if (contextEl) {
        contextEl.innerHTML = `
          <p class="text-sm text-muted">No profile active. Create a profile to empower agent calculations.</p>
          <button class="btn btn-outline-sm" style="margin-top:10px;" onclick="UI.switchTab('profile')">Create Profile</button>
        `;
      }
    }
  },

  // Render Dashboard
  renderDashboard(stats, recentRuns) {
    this.state.stats = stats;
    document.getElementById('stat-saved-jobs').textContent = stats.totalSavedJobs || 0;
    document.getElementById('stat-analyzed-jobs').textContent = stats.totalAnalyzedJobs || 0;
    document.getElementById('stat-avg-match').textContent = `${stats.averageMatchScore || 0}%`;
    document.getElementById('stat-agent-runs').textContent = stats.totalAgentRuns || 0;

    const runsListEl = document.getElementById('dashboard-recent-runs');
    if (!recentRuns || recentRuns.length === 0) {
      runsListEl.innerHTML = '<p class="empty-text">No recent agent sessions recorded. Ask the AI agent a career question to begin!</p>';
      return;
    }

    runsListEl.innerHTML = recentRuns.map(run => `
      <div style="padding:10px 0; border-bottom:1px solid #23304c; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.85rem; font-weight:600; color:#fff;">"${escapeHtml(run.user_request.substring(0, 60))}${run.user_request.length > 60 ? '...' : ''}"</div>
          <div style="font-size:0.72rem; color:#94a3b8;">${new Date(run.created_at).toLocaleTimeString()} • ${run.total_iterations} iterations • ${run.duration_ms}ms</div>
        </div>
        <span class="badge ${run.status === 'completed' ? 'score-high' : 'score-low'}">${run.status}</span>
      </div>
    `).join('');
  },

  // Render Jobs Grid
  renderJobs(jobs) {
    this.state.jobs = jobs;
    const container = document.getElementById('jobs-list-container');
    const prepSelect = document.getElementById('interview-job-select');

    // Populate Job Selector in Interview Prep
    if (prepSelect) {
      prepSelect.innerHTML = '<option value="">Choose a job...</option>' + 
        jobs.map(j => `<option value="${j.id}">${escapeHtml(j.title)} (${escapeHtml(j.company)})</option>`).join('');
    }

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p>No saved jobs found in your repository.</p>
          <div style="margin-top:14px; display:flex; gap:10px; justify-content:center;">
            <button class="btn btn-primary" onclick="UI.openAddJobModal()">Add Your First Job</button>
            <button class="btn btn-secondary" onclick="App.handleLoadDemo()">Load Demo Data</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = jobs.map(job => {
      let scoreBadge = '<span class="score-badge score-none">Not analyzed</span>';
      if (job.lastMatchScore !== null) {
        if (job.lastMatchScore >= 80) scoreBadge = `<span class="score-badge score-high">${job.lastMatchScore}% Match</span>`;
        else if (job.lastMatchScore >= 60) scoreBadge = `<span class="score-badge score-mid">${job.lastMatchScore}% Match</span>`;
        else scoreBadge = `<span class="score-badge score-low">${job.lastMatchScore}% Match</span>`;
      }

      const skillsList = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];

      return `
        <div class="job-card" data-job-id="${job.id}">
          <div class="job-header">
            <div>
              <h4 class="job-title">${escapeHtml(job.title)}</h4>
              <p class="job-company">${escapeHtml(job.company)}</p>
            </div>
            ${scoreBadge}
          </div>

          <div class="job-meta">
            <span class="meta-item">📍 ${escapeHtml(job.location)}</span>
            <span class="meta-item">💼 ${escapeHtml(job.workMode)}</span>
            ${job.salaryRange ? `<span class="meta-item">💰 ${escapeHtml(job.salaryRange)}</span>` : ''}
            <span class="meta-item">⏳ ${escapeHtml(job.experienceRequired)}</span>
          </div>

          <p class="job-desc">${escapeHtml(job.description)}</p>

          <div class="skills-pill-group">
            ${skillsList.slice(0, 6).map(s => `<span class="skill-pill">${escapeHtml(s)}</span>`).join('')}
            ${skillsList.length > 6 ? `<span class="skill-pill">+${skillsList.length - 6} more</span>` : ''}
          </div>

          <div class="job-actions">
            <button class="btn btn-primary" style="font-size:0.78rem; padding:6px 12px;" onclick="App.triggerJobAnalysis(${job.id})">
              Analyze Match
            </button>
            <button class="btn btn-secondary" style="font-size:0.78rem; padding:6px 12px;" onclick="App.triggerInterviewPrepForJob(${job.id}, '${escapeHtml(job.title)}')">
              Prep Interview
            </button>
            <button class="btn btn-ghost-sm" style="margin-left:auto; color:#ef4444;" title="Delete Job" onclick="App.handleDeleteJob(${job.id})">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Saved Job Analyses
  renderAnalyses(analyses) {
    this.state.analyses = analyses;
    const container = document.getElementById('analyses-list-container');

    if (!analyses || analyses.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p>No job evaluations saved yet.</p>
          <p class="text-sm text-muted" style="margin-top:6px;">Run the AI Agent or click "Analyze Match" on any saved job to generate an evaluation.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = analyses.map(an => {
      const matched = Array.isArray(an.matchedSkills) ? an.matchedSkills : [];
      const missing = Array.isArray(an.missingSkills) ? an.missingSkills : [];
      const recs = Array.isArray(an.recommendations) ? an.recommendations : [];

      let ringColor = 'var(--primary)';
      if (an.matchScore >= 80) ringColor = 'var(--success)';
      else if (an.matchScore < 60) ringColor = 'var(--danger)';

      return `
        <div class="analysis-card">
          <div class="analysis-header">
            <div>
              <h4 style="font-size:1.05rem; font-weight:700; color:#fff;">${escapeHtml(an.jobTitle)}</h4>
              <p style="font-size:0.85rem; color:#94a3b8;">${escapeHtml(an.company)} • ${escapeHtml(an.location || 'Remote')}</p>
            </div>
            <div class="match-ring" style="border-color:${ringColor}">
              <span class="match-ring-val">${an.matchScore}%</span>
              <span class="match-ring-lbl">Match</span>
            </div>
          </div>

          <div style="font-size:0.8rem; color:#cbd5e1;">
            Readiness: <span class="badge ${an.interviewReadiness === 'High' ? 'score-high' : 'score-mid'}">${an.interviewReadiness || 'Moderate'}</span>
            <span style="margin-left:12px; color:#64748b;">Evaluated: ${new Date(an.createdAt).toLocaleDateString()}</span>
          </div>

          <div class="skill-breakdown">
            <div class="breakdown-row">
              <span class="breakdown-title">Matched Skills (${matched.length})</span>
              <div class="skills-pill-group">
                ${matched.length > 0 ? matched.map(s => `<span class="skill-pill pill-matched">✓ ${escapeHtml(s)}</span>`).join('') : '<span class="text-xs text-muted">No direct skills matched</span>'}
              </div>
            </div>

            <div class="breakdown-row">
              <span class="breakdown-title">Missing / Gap Skills (${missing.length})</span>
              <div class="skills-pill-group">
                ${missing.length > 0 ? missing.map(s => `<span class="skill-pill pill-missing">! ${escapeHtml(s)}</span>`).join('') : '<span class="text-xs text-muted" style="color:#34d399;">✨ All core requirements satisfied</span>'}
              </div>
            </div>
          </div>

          ${recs.length > 0 ? `
            <div style="background-color:#101726; padding:12px 14px; border-radius:8px; border-left:3px solid var(--primary);">
              <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#818cf8; display:block; margin-bottom:4px;">Recommendations</span>
              <ul style="padding-left:16px; font-size:0.82rem; color:#cbd5e1;">
                ${recs.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-outline-sm" onclick="App.triggerInterviewPrepForJob(${an.jobId}, '${escapeHtml(an.jobTitle)}')">
              Prep Interview Questions
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Interview Prep Hub
  renderInterviewPrep(prepData) {
    const container = document.getElementById('interview-prep-content');
    if (!prepData) {
      container.innerHTML = '<div class="empty-state-card"><p>Select a job above or ask the AI Agent to prepare interview questions.</p></div>';
      return;
    }

    const { jobTitle, company, technicalQuestions = [], behavioralQuestions = [], skillGapQuestions = [], candidateTips = [] } = prepData;

    container.innerHTML = `
      <div style="background-color:#151d30; padding:20px; border-radius:12px; border:1px solid #23304c; margin-bottom:24px;">
        <h3 style="font-size:1.15rem; color:#fff;">Interview Preparation for: ${escapeHtml(jobTitle)} at ${escapeHtml(company)}</h3>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">Tailored technical, behavioral, and gap remediation questions generated for your profile.</p>
      </div>

      <div class="prep-section">
        <h4>🛠️ Core Technical Questions (${technicalQuestions.length})</h4>
        ${technicalQuestions.map((q, idx) => `
          <div class="question-card">
            <span class="q-badge">${escapeHtml(q.skill || 'Technical Domain')}</span>
            <p class="q-text">${idx + 1}. ${escapeHtml(q.question)}</p>
            <div class="q-points"><strong>Key Talking Points:</strong> ${escapeHtml(q.talkingPoints)}</div>
          </div>
        `).join('')}
      </div>

      <div class="prep-section">
        <h4>🤝 Behavioral Questions — STAR Method (${behavioralQuestions.length})</h4>
        ${behavioralQuestions.map((q, idx) => `
          <div class="question-card">
            <span class="q-badge">${escapeHtml(q.topic || 'Behavioral')}</span>
            <p class="q-text">${idx + 1}. ${escapeHtml(q.question)}</p>
            <div class="q-points"><strong>STAR Strategy:</strong> ${escapeHtml(q.starFramework)}</div>
          </div>
        `).join('')}
      </div>

      <div class="prep-section">
        <h4>⚡ Skill Gap & Expansion Questions (${skillGapQuestions.length})</h4>
        ${skillGapQuestions.map((q, idx) => `
          <div class="question-card">
            <span class="q-badge" style="color:#fbbf24;">${escapeHtml(q.gapSkill || 'Skill Bridge')}</span>
            <p class="q-text">${idx + 1}. ${escapeHtml(q.question)}</p>
            <div class="q-points"><strong>Recommended Approach:</strong> ${escapeHtml(q.strategy)}</div>
          </div>
        `).join('')}
      </div>

      ${candidateTips.length > 0 ? `
        <div style="background-color:#101726; padding:18px; border-radius:10px; border:1px solid #23304c;">
          <h4 style="font-size:0.9rem; font-weight:700; color:#34d399; margin-bottom:8px;">🎯 Strategic Interview Tips</h4>
          <ul style="padding-left:20px; font-size:0.85rem; color:#cbd5e1;">
            ${candidateTips.map(t => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  },

  // Render Candidate Profile / Onboarding View
  renderProfileView(profile) {
    const container = document.getElementById('profile-container');

    if (!profile) {
      // Clean Onboarding Form
      container.innerHTML = `
        <div class="profile-card">
          <div class="banner onboarding-banner" style="margin-bottom:20px;">
            <div class="banner-content">
              <span class="banner-icon">👋</span>
              <div>
                <h3>Welcome to CareerPilot</h3>
                <p>Create your candidate profile to get started with autonomous job matching and interview preparation.</p>
              </div>
            </div>
          </div>

          <form id="form-onboarding-profile" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="onboard-name">Full Name *</label>
                <input type="text" id="onboard-name" required placeholder="e.g. Jordan Smith">
              </div>
              <div class="form-group flex-1">
                <label for="onboard-email">Email Address *</label>
                <input type="email" id="onboard-email" required placeholder="e.g. jordan.smith@example.com">
              </div>
            </div>

            <div class="form-group">
              <label for="onboard-headline">Professional Headline *</label>
              <input type="text" id="onboard-headline" required placeholder="e.g. Full-Stack Software Engineer | Node.js, Express & MySQL">
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="onboard-education">Education</label>
                <input type="text" id="onboard-education" placeholder="e.g. B.S. in Computer Science">
              </div>
              <div class="form-group flex-1">
                <label for="onboard-experience">Years of Experience</label>
                <input type="number" id="onboard-experience" step="0.5" value="3.0" min="0" max="40">
              </div>
            </div>

            <div class="form-group">
              <label for="onboard-summary">Professional Summary / Bio</label>
              <textarea id="onboard-summary" rows="3" placeholder="Brief summary of your software engineering experience and interests..."></textarea>
            </div>

            <div class="form-group">
              <label for="onboard-skills">Technical Skills (Comma-separated) *</label>
              <input type="text" id="onboard-skills" required placeholder="e.g. JavaScript, Node.js, Express.js, MySQL, HTML5, CSS3, REST APIs, Git">
              <span class="text-xs text-muted">You can update proficiencies and add more skills anytime later.</span>
            </div>

            <div style="margin-top:14px; display:flex; justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Create Profile & Begin</button>
            </div>
          </form>
        </div>
      `;

      const form = document.getElementById('form-onboarding-profile');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const skillsRaw = document.getElementById('onboard-skills').value.split(',').map(s => s.trim()).filter(Boolean);
          const payload = {
            name: document.getElementById('onboard-name').value,
            email: document.getElementById('onboard-email').value,
            headline: document.getElementById('onboard-headline').value,
            education: document.getElementById('onboard-education').value,
            experienceYears: parseFloat(document.getElementById('onboard-experience').value || '0'),
            summary: document.getElementById('onboard-summary').value,
            skills: skillsRaw.map(s => ({ name: s, proficiency: 'Advanced', years: 2.5 }))
          };

          try {
            const res = await API.createProfile(payload);
            UI.showToast('Profile created successfully!', 'success');
            App.refreshApp();
          } catch (err) {
            UI.showToast(err.message, 'error');
          }
        });
      }
      return;
    }

    // Render Existing Profile Card
    const skills = profile.skills || [];
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-header-view">
          <div class="profile-avatar-lg">${(profile.name || 'U').charAt(0).toUpperCase()}</div>
          <div>
            <h3 style="font-size:1.35rem; font-weight:700; color:#fff;">${escapeHtml(profile.name)}</h3>
            <p style="font-size:0.9rem; color:#818cf8; margin-top:2px;">${escapeHtml(profile.headline)}</p>
            <p style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">📧 ${escapeHtml(profile.email)}</p>
          </div>
        </div>

        <div class="profile-meta-grid">
          <div class="profile-meta-item">
            <span class="label">Experience</span>
            <span class="val">${profile.experienceYears} Years</span>
          </div>
          <div class="profile-meta-item">
            <span class="label">Education</span>
            <span class="val">${escapeHtml(profile.education || 'Not specified')}</span>
          </div>
          <div class="profile-meta-item">
            <span class="label">Indexed Skills</span>
            <span class="val">${skills.length} Skills</span>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="font-size:0.85rem; font-weight:600; text-transform:uppercase; color:#94a3b8; margin-bottom:8px;">Professional Bio</h4>
          <p style="font-size:0.9rem; color:#cbd5e1; line-height:1.6;">${escapeHtml(profile.summary || 'No summary provided.')}</p>
        </div>

        <div>
          <h4 style="font-size:0.85rem; font-weight:600; text-transform:uppercase; color:#94a3b8; margin-bottom:12px;">Candidate Skills (${skills.length})</h4>
          <div class="skills-pill-group">
            ${skills.map(s => `
              <span class="skill-pill" style="padding:5px 10px; font-size:0.8rem;">
                <strong>${escapeHtml(s.name)}</strong> 
                <span style="color:#818cf8; font-size:0.7rem; margin-left:4px;">(${s.proficiency}, ${s.years}y)</span>
              </span>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // Render Agent Run Logs Table
  renderAgentHistory(runs) {
    const tbody = document.getElementById('agent-history-tbody');
    if (!tbody) return;

    if (!runs || runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;" class="empty-text">No agent runs recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = runs.map(r => `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td>"${escapeHtml(r.user_request.substring(0, 50))}${r.user_request.length > 50 ? '...' : ''}"</td>
        <td><span class="badge ${r.status === 'completed' ? 'score-high' : 'score-low'}">${r.status}</span></td>
        <td>${r.total_iterations}</td>
        <td>${r.tool_call_count || 0}</td>
        <td>${r.duration_ms}ms</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-outline-sm" onclick="App.viewRunDetail(${r.id})">Inspect</button>
        </td>
      </tr>
    `).join('');
  },

  // Modal: Open Add Job
  openAddJobModal() {
    const modal = document.getElementById('modal-add-job');
    if (modal) modal.showModal();
  },

  closeAddJobModal() {
    const modal = document.getElementById('modal-add-job');
    if (modal) modal.close();
  },

  // Navigation Switch
  switchTab(tabName) {
    this.state.activeTab = tabName;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${tabName}`);
    });

    // Subtitle updates
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    const titles = {
      dashboard: ['Dashboard Overview', 'AI-assisted job match analysis and interview readiness'],
      agent: ['AI Agent Studio', 'Autonomous tool calling and orchestration for career goals'],
      jobs: ['Saved Jobs Board', 'Explore, add, and evaluate candidate job listings'],
      analyses: ['Job Compatibility Analyses', 'Detailed match scores, skill gaps, and recommendations'],
      interviews: ['Interview Preparation Hub', 'Curated technical, behavioral, and gap remediation questions'],
      profile: ['Candidate Profile', 'Professional background, education, and technical skill taxonomy'],
      history: ['Agent Execution Audit Trail', 'Transparent inspection of autonomous agent sessions and tool calls']
    };

    if (titles[tabName]) {
      titleEl.textContent = titles[tabName][0];
      subEl.textContent = titles[tabName][1];
    }
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
