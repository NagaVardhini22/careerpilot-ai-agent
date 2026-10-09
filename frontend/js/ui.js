/**
 * CareerPilot — UI Rendering & State Management
 * Vanilla JavaScript DOM manipulators with Skill Builder, Live Job Search, and Auth UI.
 */

const UI = {
  // Global State
  state: {
    currentUser: null,
    activeProfile: null,
    isEditingProfile: false,
    profileSkillsDraft: [],
    jobs: [],
    liveJobs: [],
    liveProviders: [],
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

  // Update Top Header Auth UI
  updateAuthUI(user) {
    this.state.currentUser = user;
    const authBtn = document.getElementById('btn-open-auth-modal');
    const profileWidget = document.getElementById('user-profile-widget');
    const nameEl = document.getElementById('header-user-name');
    const headlineEl = document.getElementById('header-user-headline');
    const avatarEl = document.getElementById('header-avatar');

    if (user) {
      if (authBtn) authBtn.classList.add('hidden');
      if (profileWidget) profileWidget.classList.remove('hidden');
      if (nameEl) nameEl.textContent = user.name;
      if (headlineEl) {
        headlineEl.textContent = this.state.activeProfile?.headline || user.email;
      }
      if (avatarEl) avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
    } else {
      if (authBtn) authBtn.classList.remove('hidden');
      if (profileWidget) profileWidget.classList.add('hidden');
      if (nameEl) nameEl.textContent = 'Guest Candidate';
      if (headlineEl) headlineEl.textContent = 'Sign in to access your profile';
      if (avatarEl) avatarEl.textContent = '?';
    }
  },

  // Update Header User Pill from Profile
  updateHeaderProfile(profile) {
    this.state.activeProfile = profile;
    const headlineEl = document.getElementById('header-user-headline');
    const onboardingBanner = document.getElementById('onboarding-banner');
    const contextEl = document.getElementById('agent-context-profile');

    if (profile) {
      if (headlineEl) headlineEl.textContent = profile.headline || 'Active Candidate';
      if (onboardingBanner) onboardingBanner.classList.add('hidden');

      if (contextEl) {
        const qual = profile.qualification ? `${profile.qualification}${profile.fieldOfStudy ? ' in ' + profile.fieldOfStudy : ''}` : (profile.education || 'Not specified');
        contextEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:700; color:#fff;">${escapeHtml(profile.name)}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(profile.headline)}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">Education: <strong>${escapeHtml(qual)}</strong></div>
            <div style="font-size:0.75rem; color:#94a3b8;">Experience: <strong>${profile.experienceYears !== null ? profile.experienceYears + ' yrs' : 'Not specified'}</strong></div>
            <div style="font-size:0.75rem; color:#94a3b8;">Skills: <strong>${profile.skills ? profile.skills.length : 0} indexed</strong></div>
          </div>
        `;
      }
    } else {
      if (headlineEl && !this.state.currentUser) headlineEl.textContent = 'No profile created';
      if (onboardingBanner) onboardingBanner.classList.remove('hidden');

      if (contextEl) {
        contextEl.innerHTML = `
          <p class="text-sm text-muted">No candidate profile active. Create a profile to empower agent calculations.</p>
          <button class="btn btn-outline-sm" style="margin-top:10px;" onclick="UI.switchTab('profile')">Create Profile</button>
        `;
      }
    }
  },

  // Auth Modal Management
  openAuthModal(mode = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    this.switchAuthTab(mode);
    this.clearAuthError();
    modal.showModal();
  },

  closeAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.close();
  },

  switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-auth-login');
    const registerTab = document.getElementById('tab-auth-register');
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const title = document.getElementById('auth-modal-title');

    this.clearAuthError();

    if (tab === 'login') {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      title.textContent = 'Sign In to CareerPilot';
    } else {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      title.textContent = 'Create CareerPilot Account';
    }
  },

  setAuthError(message) {
    const alertBox = document.getElementById('auth-error-alert');
    if (alertBox) {
      alertBox.textContent = message;
      alertBox.classList.remove('hidden');
    }
  },

  clearAuthError() {
    const alertBox = document.getElementById('auth-error-alert');
    if (alertBox) {
      alertBox.textContent = '';
      alertBox.classList.add('hidden');
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

    if (prepSelect) {
      const currentVal = prepSelect.value;
      prepSelect.innerHTML = '<option value="">Choose a job to prepare...</option>' +
        jobs.map(j => `<option value="${j.id}" ${j.id == currentVal ? 'selected' : ''}>${escapeHtml(j.title)} at ${escapeHtml(j.company)}</option>`).join('');
    }

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p>No saved jobs found in your repository.</p>
          <p class="text-sm text-muted">Click <strong>"Add New Job"</strong> or browse <strong>"Live Job Search"</strong> to discover real openings!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = jobs.map(job => {
      const skills = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
      const scoreBadge = job.lastMatchScore !== null
        ? `<span class="badge ${job.lastMatchScore >= 80 ? 'score-high' : (job.lastMatchScore >= 60 ? 'score-mid' : 'score-low')}">${job.lastMatchScore}% Match</span>`
        : '<span class="badge" style="background:#334155; color:#94a3b8;">Not Analyzed</span>';

      const isExternalBadge = job.isExternal || job.is_external
        ? `<span class="badge" style="background:rgba(99,102,241,0.2); color:#818cf8; border:1px solid rgba(99,102,241,0.4);">${escapeHtml(job.sourceName || job.source_name || 'External')}</span>`
        : '';

      return `
        <div class="job-card">
          <div class="job-card-header">
            <div>
              <div class="job-title">${escapeHtml(job.title)}</div>
              <div class="job-company">${escapeHtml(job.company)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              ${scoreBadge}
              ${isExternalBadge}
            </div>
          </div>

          <div class="job-meta">
            <span>📍 ${escapeHtml(job.location)}</span>
            <span>💼 ${escapeHtml(job.workMode)}</span>
            ${job.salaryRange ? `<span>💵 ${escapeHtml(job.salaryRange)}</span>` : ''}
          </div>

          <p class="job-desc-snippet">${escapeHtml((job.description || '').substring(0, 160))}...</p>

          <div class="skills-pill-group">
            ${skills.slice(0, 5).map(s => `<span class="skill-pill">${escapeHtml(s)}</span>`).join('')}
            ${skills.length > 5 ? `<span class="skill-pill text-muted">+${skills.length - 5}</span>` : ''}
          </div>

          <div class="job-card-footer">
            <span class="text-xs text-muted">Added: ${new Date(job.createdAt).toLocaleDateString()}</span>
            <div class="job-card-actions">
              ${job.originalUrl ? `<a href="${escapeHtml(job.originalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost-sm" title="Open original job posting">Original ↗</a>` : ''}
              <button class="btn btn-outline-sm" onclick="App.analyzeJob(${job.id})">Analyze Match</button>
              <button class="btn btn-ghost-sm btn-delete-icon" onclick="App.deleteJob(${job.id})" title="Delete job">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Job Analyses Grid
  renderAnalyses(analyses) {
    this.state.analyses = analyses;
    const container = document.getElementById('analyses-list-container');
    if (!analyses || analyses.length === 0) {
      container.innerHTML = '<div class="empty-state-card"><p>No job evaluations found. Open <strong>Jobs Board</strong> and click <strong>Analyze Match</strong> on any role!</p></div>';
      return;
    }

    container.innerHTML = analyses.map(an => {
      const matched = Array.isArray(an.matchedSkills) ? an.matchedSkills : [];
      const missing = Array.isArray(an.missingSkills) ? an.missingSkills : [];
      const recs = Array.isArray(an.recommendations) ? an.recommendations : [];

      return `
        <div class="analysis-card">
          <div class="analysis-card-header">
            <div>
              <div class="job-title">${escapeHtml(an.jobTitle)}</div>
              <div class="job-company">${escapeHtml(an.company)} • ${escapeHtml(an.location)}</div>
            </div>
            <div class="score-dial">
              <span class="score-number ${an.matchScore >= 80 ? 'score-high-text' : (an.matchScore >= 60 ? 'score-mid-text' : 'score-low-text')}">${an.matchScore}%</span>
              <span class="score-label">MATCH</span>
            </div>
          </div>

          <div class="readiness-indicator">
            <span class="text-xs text-muted">Interview Readiness:</span>
            <span class="badge ${an.interviewReadiness === 'High' ? 'score-high' : (an.interviewReadiness === 'Moderate' ? 'score-mid' : 'score-low')}">${an.interviewReadiness}</span>
          </div>

          <div class="skills-breakdown">
            <div>
              <div class="text-xs text-muted" style="margin-bottom:6px;">✅ Matched Skills (${matched.length}):</div>
              <div class="skills-pill-group">
                ${matched.map(s => `<span class="skill-pill skill-matched">${escapeHtml(s)}</span>`).join('')}
              </div>
            </div>
            ${missing.length > 0 ? `
              <div style="margin-top:10px;">
                <div class="text-xs text-muted" style="margin-bottom:6px;">⚠️ Missing Skills / Gaps (${missing.length}):</div>
                <div class="skills-pill-group">
                  ${missing.map(s => `<span class="skill-pill skill-missing">${escapeHtml(s)}</span>`).join('')}
                </div>
              </div>
            ` : '<div style="margin-top:8px; font-size:0.75rem; color:#34d399;">✨ All required core skills matched!</div>'}
          </div>

          <div class="analysis-recs">
            <div class="text-xs text-muted" style="margin-bottom:6px;">💡 Recommendations:</div>
            <ul>
              ${recs.slice(0, 3).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          </div>

          <div class="analysis-footer">
            <span class="text-xs text-muted">Analyzed: ${new Date(an.createdAt).toLocaleDateString()}</span>
            <button class="btn btn-outline-sm" onclick="App.prepareInterviewForJob(${an.jobId})">Prepare Interview Questions</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Interview Prep View
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

      ${skillGapQuestions.length > 0 ? `
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
      ` : ''}

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

  // Skill Builder Helpers
  renderSkillRows(skills) {
    const listEl = document.getElementById('skill-builder-rows');
    if (!listEl) return;

    if (!skills || skills.length === 0) {
      listEl.innerHTML = '<div class="empty-skill-hint" id="empty-skill-hint">No skills added yet. Type a skill name or paste comma-separated skills above.</div>';
      return;
    }

    listEl.innerHTML = skills.map((s, idx) => `
      <div class="skill-row" data-index="${idx}">
        <input type="text" class="skill-input-name" value="${escapeHtml(s.name)}" placeholder="Skill name (e.g. React)" required>
        <select class="skill-input-prof">
          <option value="Not specified" ${s.proficiency === 'Not specified' ? 'selected' : ''}>Not specified</option>
          <option value="Beginner" ${s.proficiency === 'Beginner' ? 'selected' : ''}>Beginner</option>
          <option value="Intermediate" ${s.proficiency === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
          <option value="Advanced" ${s.proficiency === 'Advanced' ? 'selected' : ''}>Advanced</option>
          <option value="Expert" ${s.proficiency === 'Expert' ? 'selected' : ''}>Expert</option>
        </select>
        <input type="number" class="skill-input-years" min="0" step="0.5" value="${s.years !== null && s.years !== undefined ? s.years : ''}" placeholder="Years (optional)">
        <button type="button" class="btn-remove-skill" onclick="UI.removeSkillRow(${idx})" title="Remove skill">✕</button>
      </div>
    `).join('');
  },

  addSkillsFromInput(rawInput) {
    if (!rawInput || !rawInput.trim()) return;
    const splitNames = rawInput.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const existing = this.collectSkillsFromBuilder();

    for (const name of splitNames) {
      const clean = name.trim();
      if (!existing.some(e => e.name.toLowerCase() === clean.toLowerCase())) {
        existing.push({
          name: clean,
          proficiency: 'Not specified',
          years: null
        });
      }
    }

    this.state.profileSkillsDraft = existing;
    this.renderSkillRows(existing);
  },

  removeSkillRow(index) {
    const skills = this.collectSkillsFromBuilder();
    skills.splice(index, 1);
    this.state.profileSkillsDraft = skills;
    this.renderSkillRows(skills);
  },

  collectSkillsFromBuilder() {
    const rows = document.querySelectorAll('.skill-row');
    const result = [];
    rows.forEach(row => {
      const nameInput = row.querySelector('.skill-input-name');
      const profSelect = row.querySelector('.skill-input-prof');
      const yearsInput = row.querySelector('.skill-input-years');

      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) return;

      const proficiency = profSelect ? profSelect.value : 'Not specified';
      let years = null;
      if (yearsInput && yearsInput.value !== '') {
        const parsed = parseFloat(yearsInput.value);
        if (!isNaN(parsed) && parsed >= 0) {
          years = parsed;
        }
      }

      result.push({ name, proficiency, years });
    });
    return result;
  },

  // Render Candidate Profile / Form View
  renderProfileView(profile, forceEdit = false) {
    const container = document.getElementById('profile-container');
    if (!container) return;

    if (!profile || forceEdit) {
      // Edit / Create Form
      const existingSkills = profile?.skills || [];
      this.state.profileSkillsDraft = existingSkills.map(s => ({
        name: s.name,
        proficiency: s.proficiency || 'Not specified',
        years: s.years !== null && s.years !== undefined ? s.years : null
      }));

      const qualificationOptions = [
        'B.Tech', 'B.E.', 'B.Sc.', 'B.Com.', 'B.A.', 'BCA', 'BBA',
        'M.Tech/M.E.', 'M.Sc.', 'MCA', 'MBA', 'Diploma', 'Intermediate/12th', 'Other'
      ];

      const currentQual = profile?.qualification || '';

      container.innerHTML = `
        <div class="profile-card profile-form-card">
          <div class="profile-form-header">
            <h3>${profile ? 'Edit Candidate Profile' : 'Create Candidate Profile'}</h3>
            <p class="text-xs text-muted">Accurate candidate qualifications and technical skill proficiencies.</p>
          </div>

          <form id="form-candidate-profile" class="modal-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="prof-name">Full Name *</label>
                <input type="text" id="prof-name" required value="${escapeHtml(profile?.name || this.state.currentUser?.name || '')}" placeholder="e.g. Jordan Smith">
              </div>
              <div class="form-group flex-1">
                <label for="prof-headline">Professional Headline *</label>
                <input type="text" id="prof-headline" required value="${escapeHtml(profile?.headline || '')}" placeholder="e.g. Full-Stack Developer | Node.js, Express & MySQL">
              </div>
            </div>

            <!-- Education Qualification Grid -->
            <div class="education-section-box">
              <h4 class="section-subtitle">🎓 Education & Academic Background</h4>
              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="prof-qualification">Degree / Qualification</label>
                  <select id="prof-qualification">
                    <option value="">Select qualification...</option>
                    ${qualificationOptions.map(q => `<option value="${q}" ${currentQual === q ? 'selected' : ''}>${q}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group flex-1">
                  <label for="prof-field">Field of Study / Specialization</label>
                  <input type="text" id="prof-field" value="${escapeHtml(profile?.fieldOfStudy || '')}" placeholder="e.g. Information Technology, Computer Science">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="prof-institution">Institution / University (Optional)</label>
                  <input type="text" id="prof-institution" value="${escapeHtml(profile?.institution || '')}" placeholder="e.g. State University of Engineering">
                </div>
                <div class="form-group" style="width: 140px;">
                  <label for="prof-grad-year">Grad Year</label>
                  <input type="number" id="prof-grad-year" min="1950" max="2040" value="${profile?.graduationYear || ''}" placeholder="e.g. 2024">
                </div>
                <div class="form-group" style="width: 160px;">
                  <label for="prof-total-exp">Total Experience</label>
                  <input type="number" id="prof-total-exp" min="0" step="0.5" value="${profile?.experienceYears !== null && profile?.experienceYears !== undefined ? profile.experienceYears : ''}" placeholder="Years (optional)">
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="prof-summary">Professional Bio / Summary</label>
              <textarea id="prof-summary" rows="3" placeholder="Summary of your technical expertise, career achievements, and focus areas...">${escapeHtml(profile?.summary || '')}</textarea>
            </div>

            <!-- Skill Builder Component -->
            <div class="skill-builder-container">
              <div class="skill-builder-header">
                <div>
                  <h4 class="section-subtitle">🛠️ Technical Skills Builder</h4>
                  <p class="text-xs text-muted">Add skills individually or paste comma-separated names. Leave experience empty if not applicable.</p>
                </div>
              </div>

              <div class="skill-quick-add-bar">
                <input type="text" id="skill-quick-add-input" placeholder="Type or paste skills (e.g. React, Node.js, MySQL, Docker)...">
                <button type="button" class="btn btn-primary btn-sm" id="btn-quick-add-skills">+ Add Skills</button>
              </div>

              <div class="skill-table-header">
                <span style="flex:2;">Skill Name</span>
                <span style="flex:1.5;">Proficiency Level</span>
                <span style="flex:1;">Experience</span>
                <span style="width:36px;"></span>
              </div>

              <div class="skill-builder-rows" id="skill-builder-rows">
                <!-- Editable rows rendered here -->
              </div>
            </div>

            <div class="form-actions-bar">
              ${profile ? `<button type="button" class="btn btn-secondary" onclick="UI.renderProfileView(UI.state.activeProfile, false)">Cancel</button>` : ''}
              <button type="submit" class="btn btn-primary">${profile ? 'Save Profile Changes' : 'Create Profile & Continue'}</button>
            </div>
          </form>
        </div>
      `;

      // Render initial skill rows
      this.renderSkillRows(this.state.profileSkillsDraft);

      // Event listener: Quick Add Skills
      const quickAddBtn = document.getElementById('btn-quick-add-skills');
      const quickAddInput = document.getElementById('skill-quick-add-input');
      if (quickAddBtn && quickAddInput) {
        quickAddBtn.addEventListener('click', () => {
          this.addSkillsFromInput(quickAddInput.value);
          quickAddInput.value = '';
        });
        quickAddInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.addSkillsFromInput(quickAddInput.value);
            quickAddInput.value = '';
          }
        });
      }

      // Event listener: Form Submit
      const form = document.getElementById('form-candidate-profile');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const skills = this.collectSkillsFromBuilder();
          const qual = document.getElementById('prof-qualification').value.trim();
          const field = document.getElementById('prof-field').value.trim();
          const inst = document.getElementById('prof-institution').value.trim();
          const gradYearRaw = document.getElementById('prof-grad-year').value.trim();
          const expYearsRaw = document.getElementById('prof-total-exp').value.trim();

          const payload = {
            name: document.getElementById('prof-name').value.trim(),
            headline: document.getElementById('prof-headline').value.trim(),
            qualification: qual || null,
            fieldOfStudy: field || null,
            institution: inst || null,
            graduationYear: gradYearRaw ? parseInt(gradYearRaw, 10) : null,
            experienceYears: expYearsRaw !== '' ? parseFloat(expYearsRaw) : null,
            summary: document.getElementById('prof-summary').value.trim(),
            skills
          };

          try {
            if (profile && profile.id) {
              await API.updateProfile(profile.id, payload);
              UI.showToast('Profile updated successfully!', 'success');
            } else {
              await API.createProfile(payload);
              UI.showToast('Profile created successfully!', 'success');
            }
            await App.refreshApp();
          } catch (err) {
            UI.showToast(err.message, 'error');
          }
        });
      }
      return;
    }

    // View Mode (Existing Profile)
    const skills = profile.skills || [];
    const qualDisplay = profile.qualification
      ? `${escapeHtml(profile.qualification)}${profile.fieldOfStudy ? ' in ' + escapeHtml(profile.fieldOfStudy) : ''}`
      : (escapeHtml(profile.education || 'Not specified'));

    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-header-view">
          <div class="profile-avatar-lg">${(profile.name || 'U').charAt(0).toUpperCase()}</div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <h3 style="font-size:1.35rem; font-weight:700; color:#fff;">${escapeHtml(profile.name)}</h3>
                <p style="font-size:0.9rem; color:#818cf8; margin-top:2px;">${escapeHtml(profile.headline)}</p>
                <p style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">📧 ${escapeHtml(profile.email)}</p>
              </div>
              <button class="btn btn-outline-sm" id="btn-edit-profile-view">
                ✏️ Edit Profile & Skills
              </button>
            </div>
          </div>
        </div>

        <div class="profile-meta-grid">
          <div class="profile-meta-item">
            <span class="label">Total Experience</span>
            <span class="val">${profile.experienceYears !== null ? profile.experienceYears + ' Years' : 'Not specified'}</span>
          </div>
          <div class="profile-meta-item">
            <span class="label">Qualification</span>
            <span class="val">${qualDisplay}</span>
          </div>
          <div class="profile-meta-item">
            <span class="label">Institution</span>
            <span class="val">${escapeHtml(profile.institution || 'Not specified')} ${profile.graduationYear ? '(' + profile.graduationYear + ')' : ''}</span>
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
            ${skills.map(s => {
              const profColor = s.proficiency === 'Expert' ? '#34d399' : (s.proficiency === 'Advanced' ? '#818cf8' : (s.proficiency === 'Intermediate' ? '#38bdf8' : '#94a3b8'));
              const yrsStr = s.years !== null && s.years !== undefined ? ` • ${s.years}y` : '';
              return `
                <span class="skill-pill" style="padding:6px 12px; font-size:0.82rem;">
                  <strong>${escapeHtml(s.name)}</strong>
                  <span style="color:${profColor}; font-size:0.72rem; margin-left:6px;">(${s.proficiency}${yrsStr})</span>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const editBtn = document.getElementById('btn-edit-profile-view');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.renderProfileView(profile, true);
      });
    }
  },

  // Render Live Job Providers Status Bar
  renderLiveJobProviders(providers) {
    this.state.liveProviders = providers;
    const bar = document.getElementById('live-provider-status-bar');
    if (!bar || !providers) return;

    bar.innerHTML = providers.map(p => {
      const isOk = p.configured;
      return `
        <div class="provider-chip ${isOk ? 'configured' : 'unconfigured'}" title="${p.notes}">
          <span class="provider-dot"></span>
          <span class="provider-name">${escapeHtml(p.name)}</span>
          <span class="provider-badge">${isOk ? 'Active' : 'Unconfigured'}</span>
        </div>
      `;
    }).join('');
  },

  // Render Live Job Search Results
  renderLiveJobs(searchData) {
    const listContainer = document.getElementById('live-jobs-list-container');
    const linksContainer = document.getElementById('external-links-container');
    const countEl = document.getElementById('live-results-count');
    const timeEl = document.getElementById('live-retrieval-timestamp');

    if (!listContainer) return;

    const jobs = searchData.jobs || [];
    const links = searchData.externalSearchLinks || [];

    if (countEl) countEl.textContent = jobs.length;
    if (timeEl) {
      timeEl.textContent = searchData.cached
        ? `Cached results (${new Date(searchData.cachedAt).toLocaleTimeString()})`
        : `Live query at ${new Date(searchData.retrievedAt).toLocaleTimeString()}`;
    }

    if (jobs.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p>No active openings matched your criteria across connected career boards.</p>
          <p class="text-sm text-muted">Try broadening your keywords or location, or click the direct portal links below!</p>
        </div>
      `;
    } else {
      listContainer.innerHTML = jobs.map(j => `
        <div class="job-card live-job-card">
          <div class="job-card-header">
            <div>
              <div class="job-title">${escapeHtml(j.title)}</div>
              <div class="job-company">${escapeHtml(j.company)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              <span class="badge ${searchData.cached ? 'job-badge-cached' : 'job-badge-live'}">${searchData.cached ? 'Cached' : 'Live'}</span>
              <span class="badge" style="background:#1e293b; color:#94a3b8; border:1px solid #334155;">${escapeHtml(j.sourceName)}</span>
            </div>
          </div>

          <div class="job-meta">
            <span>📍 ${escapeHtml(j.location)}</span>
            <span>💼 ${escapeHtml(j.workMode)}</span>
            ${j.salaryRange ? `<span>💵 ${escapeHtml(j.salaryRange)}</span>` : ''}
          </div>

          <p class="job-desc-snippet">${escapeHtml((j.description || '').substring(0, 160))}...</p>

          <div class="skills-pill-group">
            ${(j.requiredSkills || []).slice(0, 5).map(s => `<span class="skill-pill">${escapeHtml(s)}</span>`).join('')}
            ${(j.requiredSkills || []).length > 5 ? `<span class="skill-pill text-muted">+${j.requiredSkills.length - 5}</span>` : ''}
          </div>

          <div class="job-card-footer">
            <span class="text-xs text-muted">Source: ${escapeHtml(j.sourceName)}</span>
            <div class="job-card-actions">
              ${j.originalUrl ? `<a href="${escapeHtml(j.originalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost-sm" title="Open official job post">View Original ↗</a>` : ''}
              <button class="btn btn-primary btn-sm" onclick="App.handleSaveExternalJob(${escapeHtml(JSON.stringify(j))})">Save to Board</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Render External Search Deep Links
    if (linksContainer && links.length > 0) {
      linksContainer.innerHTML = links.map(link => `
        <div class="external-link-card">
          <div class="ext-card-header">
            <strong>${escapeHtml(link.portal)}</strong>
            <span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399;">Direct Link</span>
          </div>
          <p class="text-xs text-muted" style="margin:6px 0;">${escapeHtml(link.description)}</p>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-sm btn-block" style="text-align:center; display:block;">
            Open ${escapeHtml(link.portal)} Search ↗
          </a>
        </div>
      `).join('');
    }
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
      'live-jobs': ['Live Job Search', 'Discover real-time postings across external company career boards'],
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
