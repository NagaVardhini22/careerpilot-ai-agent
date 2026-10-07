/**
 * CareerPilot — AI Agent Controller
 * Manages prompt submission, real-time activity stepper, and response rendering.
 */

const Agent = {
  isExecuting: false,

  init() {
    const form = document.getElementById('agent-prompt-form');
    const textarea = document.getElementById('agent-prompt-input');
    const copyBtn = document.getElementById('btn-copy-response');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executePrompt();
      });
    }

    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.executePrompt();
        }
      });
    }

    // Quick Prompt Chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (textarea && prompt) {
          textarea.value = prompt;
          textarea.focus();
        }
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const body = document.getElementById('agent-response-body');
        if (body) {
          navigator.clipboard.writeText(body.innerText);
          UI.showToast('Agent response copied to clipboard!', 'info');
        }
      });
    }
  },

  async executePrompt(customPrompt = null) {
    if (this.isExecuting) return;

    const textarea = document.getElementById('agent-prompt-input');
    const prompt = customPrompt || (textarea ? textarea.value.trim() : '');

    if (!prompt) {
      UI.showToast('Please enter a career question or instruction.', 'error');
      return;
    }

    this.isExecuting = true;
    this.setLoadingState(true);

    const activityBox = document.getElementById('agent-activity-box');
    const stepperList = document.getElementById('activity-stepper-list');
    const responseBox = document.getElementById('agent-response-container');
    const responseBody = document.getElementById('agent-response-body');
    const statusText = document.getElementById('activity-status-text');
    const durationText = document.getElementById('activity-duration');

    activityBox.classList.remove('hidden');
    responseBox.classList.add('hidden');
    stepperList.innerHTML = '';
    statusText.textContent = 'Agent Orchestrator Executing...';
    durationText.textContent = '';

    const candidateId = UI.state.activeProfile ? UI.state.activeProfile.id : null;
    const startTime = Date.now();

    try {
      // API call to Express agent orchestrator
      const res = await API.runAgent(prompt, 1, candidateId);

      // Render step-by-step activity stepper with animated intervals
      const activities = res.activities || [];
      for (let i = 0; i < activities.length; i++) {
        await new Promise(r => setTimeout(r, 120)); // Subtle staggered animation
        this.addActivityStep(stepperList, activities[i]);
      }

      statusText.textContent = `Completed in ${res.totalIterations || 1} iterations`;
      durationText.textContent = `${res.durationMs || (Date.now() - startTime)}ms`;

      // Render Markdown Response
      responseBox.classList.remove('hidden');
      responseBody.innerHTML = this.renderMarkdown(res.finalResponse || 'Agent produced no text.');

      // Refresh data across tabs
      App.refreshSilent();
    } catch (error) {
      console.error('Agent execution error:', error);
      statusText.textContent = 'Agent execution failed';
      this.addActivityStep(stepperList, {
        tool: 'agent_orchestrator',
        status: 'failed',
        summary: error.message
      });
      UI.showToast(error.message, 'error');
    } finally {
      this.isExecuting = false;
      this.setLoadingState(false);
    }
  },

  addActivityStep(container, step) {
    const el = document.createElement('div');
    el.className = 'step-item';
    const isSuccess = step.status === 'success';
    el.innerHTML = `
      <div class="step-badge ${isSuccess ? '' : 'failed'}">${isSuccess ? '✓' : '✕'}</div>
      <div class="step-content">
        <span class="step-tool">${escapeHtml(step.tool || 'orchestrator')}</span>
        <span class="step-summary">${escapeHtml(step.summary || '')}</span>
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  setLoadingState(loading) {
    const btn = document.getElementById('btn-submit-agent');
    const spinner = document.getElementById('activity-spinner');
    if (btn) {
      btn.disabled = loading;
      btn.innerHTML = loading
        ? '<span class="spinner-small" style="margin-right:6px;"></span> Orchestrating...'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Run Agent';
    }
    if (spinner) {
      spinner.style.display = loading ? 'inline-block' : 'none';
    }
  },

  // Lightweight Markdown to HTML converter
  renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code blocks & inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Unordered lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
  }
};
