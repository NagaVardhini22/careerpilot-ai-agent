/**
 * Modular LLM Service & Dynamic Agent Planner
 * Supports OpenAI, Gemini, and deterministic Offline Mock Agent Planner.
 */

const env = require('../config/env');

/**
 * Main LLM invocation method
 * Returns: { content: string|null, tool_calls?: Array<{ id: string, type: 'function', function: { name: string, arguments: string } }> }
 */
async function callLLM(messages, tools = []) {
  const provider = env.ai.provider;
  const apiKey = env.ai.apiKey;

  // Use real provider if apiKey is present and provider is not forced to mock
  if (apiKey && provider === 'openai') {
    return await callOpenAI(messages, tools);
  } else if (apiKey && provider === 'gemini') {
    return await callGemini(messages, tools);
  }

  // Fallback to offline Dynamic Agent Planner
  return await mockAgentPlanner(messages, tools);
}

/**
 * OpenAI API Provider
 */
async function callOpenAI(messages, tools) {
  const payload = {
    model: env.ai.model || 'gpt-4o-mini',
    messages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined
  };

  const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.ai.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message) {
    throw new Error('Malformed response from OpenAI API.');
  }

  return {
    content: choice.message.content || null,
    tool_calls: choice.message.tool_calls || null
  };
}

/**
 * Google Gemini API Provider
 */
async function callGemini(messages, tools) {
  const model = env.ai.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.ai.apiKey}`;

  const functionDeclarations = tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters
  }));

  const contents = [];
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      if (m.tool_calls) {
        m.tool_calls.forEach(tc => {
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}
          parts.push({ functionCall: { name: tc.function.name, args } });
        });
      }
      contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: m.name,
            response: { content: m.content }
          }
        }]
      });
    }
  }

  const payload = {
    contents,
    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content) {
    throw new Error('Malformed response from Gemini API.');
  }

  const parts = candidate.content.parts || [];
  let content = null;
  const tool_calls = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.text) content = (content ? content + '\n' : '') + p.text;
    if (p.functionCall) {
      tool_calls.push({
        id: `gemini_call_${Date.now()}_${i}`,
        type: 'function',
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args || {})
        }
      });
    }
  }

  return {
    content: content || null,
    tool_calls: tool_calls.length > 0 ? tool_calls : null
  };
}

/**
 * Deterministic Mock Agent Planner
 * Implements real agent planning and function-calling decisions offline.
 * Analyzes conversational history, user query intent, and prior tool results dynamically.
 */
async function mockAgentPlanner(messages, tools) {
  const userMsg = messages.find(m => m.role === 'user');
  const userText = (userMsg ? userMsg.content : '').toLowerCase();

  const executedTools = messages
    .filter(m => m.role === 'tool')
    .map(m => {
      let data = null;
      try { data = JSON.parse(m.content); } catch {}
      return { name: m.name, data };
    });

  const executedNames = new Set(executedTools.map(t => t.name));

  // 1. First step for almost all intent: inspect candidate profile
  if (!executedNames.has('getCandidateProfile')) {
    return {
      tool_calls: [{
        id: `call_${Date.now()}_profile`,
        type: 'function',
        function: {
          name: 'getCandidateProfile',
          arguments: '{}'
        }
      }]
    };
  }

  const profileTool = executedTools.find(t => t.name === 'getCandidateProfile');
  const profile = profileTool ? profileTool.data : {};

  // If candidate profile does not exist yet (fresh state):
  if (profile && profile.exists === false) {
    return {
      content: `👋 **Welcome to CareerPilot!**

I noticed that you have not created your candidate profile yet. To evaluate job opportunities, calculate skill match scores, and generate interview preparation strategies, I need your background details.

Please click **"Profile"** in the sidebar to create your profile and add your technical skills. Once created, I will be ready to help you land your target roles!`
    };
  }

  // 2. Check for live external job discovery intent
  const isLiveSearchReq = userText.includes('live') || userText.includes('search') || userText.includes('external') || userText.includes('openings') || (userText.includes('find') && (userText.includes('job') || userText.includes('role') || userText.includes('developer') || userText.includes('engineer')));
  if (isLiveSearchReq && !userText.includes('saved')) {
    if (!executedNames.has('searchLiveJobs')) {
      let keyword = 'Software Engineer';
      if (userText.includes('python')) keyword = 'Python';
      else if (userText.includes('react')) keyword = 'React';
      else if (userText.includes('frontend')) keyword = 'Frontend';
      else if (userText.includes('backend')) keyword = 'Backend';
      else if (userText.includes('devops')) keyword = 'DevOps';
      else if (userText.includes('entry') || userText.includes('junior')) keyword = 'Junior Developer';

      let location = 'India';
      if (userText.includes('remote')) location = 'Remote';
      else if (userText.includes('bangalore')) location = 'Bangalore';
      else if (userText.includes('hyderabad')) location = 'Hyderabad';

      const remoteOnly = userText.includes('remote');
      const experienceLevel = userText.includes('entry') ? 'Entry-level' : '';

      return {
        tool_calls: [{
          id: `call_${Date.now()}_searchLive`,
          type: 'function',
          function: {
            name: 'searchLiveJobs',
            arguments: JSON.stringify({ keyword, location, remoteOnly, experienceLevel })
          }
        }]
      };
    }

    const liveTool = executedTools.find(t => t.name === 'searchLiveJobs');
    const liveData = liveTool ? liveTool.data : {};
    const sampleJobs = liveData.sampleJobs || [];
    const extLinks = liveData.externalSearchLinks || [];

    return {
      content: `### 🌐 Live Job Discovery Results

I searched active career portals and public company boards for **"${liveData.query?.keyword || 'Developer'}"** (Location: \`${liveData.query?.location || 'Any'}\`).

#### Discovered Postings (${liveData.totalFound} found):
${sampleJobs.length > 0 ? sampleJobs.map((j, idx) => `${idx + 1}. **[${j.title}](${j.url || '#'})** at **${j.company}** (\`${j.workMode}\` - ${j.location})\n   - Core Skills: ${j.skills && j.skills.length > 0 ? j.skills.join(', ') : 'General tech'}\n   - Source: *${j.source}*`).join('\n\n') : '_No active listings matched the exact query on configured public boards. Explore the verified direct search links below._'}

#### Direct Official Portal Searches:
${extLinks.map(l => `- **[${l.title}](${l.url})** (${l.portal}) — ${l.description}`).join('\n')}

💡 *Tip: Navigate to the **Live Job Search** tab in CareerPilot to view all listings, filter by work mode, and save openings directly to your Board for personalized preparation!*

*(Note: Executed using CareerPilot Offline Deterministic Agent Planner with function calling)*`
    };
  }

  // 3. Check for application history intent
  const isHistoryReq = userText.includes('history') || userText.includes('previous') || userText.includes('analyses') || userText.includes('past') || userText.includes('application');
  if (isHistoryReq) {
    if (!executedNames.has('getApplicationHistory')) {
      return {
        tool_calls: [{
          id: `call_${Date.now()}_history`,
          type: 'function',
          function: {
            name: 'getApplicationHistory',
            arguments: JSON.stringify({ candidateId: profile.candidateId, limit: 10 })
          }
        }]
      };
    }

    const histTool = executedTools.find(t => t.name === 'getApplicationHistory');
    const histData = histTool ? histTool.data : {};
    const apps = histData.applications || [];
    const analyses = histData.pastAnalyses || [];

    if (apps.length === 0 && analyses.length === 0) {
      return {
        content: `Hello **${profile.name || 'there'}**, you currently do not have any recorded job applications or prior analyses in the system.

Try adding or saving jobs on your **Jobs Board**, then ask me: *"Which of my saved jobs is the best match for me?"* to run your first evaluation!`
      };
    }

    return {
      content: `### 📋 Application & Analysis History for **${profile.name}**

#### Active Applications (${apps.length}):
${apps.length > 0 ? apps.map(a => `- **${a.jobTitle}** at **${a.company}** — Status: \`${a.status.toUpperCase()}\` (Applied: ${a.appliedDate})`).join('\n') : '_No active applications recorded._'}

#### Prior Job Analyses (${analyses.length}):
${analyses.length > 0 ? analyses.map(an => `- **${an.jobTitle}** (${an.company}) — Match Score: **${an.matchScore}%** | Readiness: \`${an.interviewReadiness}\``).join('\n') : '_No saved analyses recorded._'}

You can ask me to re-analyze any role or generate targeted interview prep questions!

*(Generated using CareerPilot Deterministic Agent Planner)*`
    };
  }

  // 4. Saved Jobs Retrieval
  if (!executedNames.has('getSavedJobs') && !executedNames.has('getJobDetails')) {
    const isJsFilter = userText.includes('javascript') || userText.includes('js');
    const filter = isJsFilter ? { status: 'saved', keyword: 'JavaScript' } : { status: 'saved', limit: 10 };
    return {
      tool_calls: [{
        id: `call_${Date.now()}_jobs`,
        type: 'function',
        function: {
          name: 'getSavedJobs',
          arguments: JSON.stringify(filter)
        }
      }]
    };
  }

  const jobsTool = executedTools.find(t => t.name === 'getSavedJobs');
  const jobsList = jobsTool && jobsTool.data ? (jobsTool.data.jobs || []) : [];

  // If no saved jobs found in database
  if (jobsList.length === 0 && !executedNames.has('getJobDetails')) {
    return {
      content: `Hello **${profile.name || 'there'}**! 

I retrieved your profile successfully, but found **no saved jobs** in your repository.

To get started:
1. Navigate to the **Jobs Board** tab and click **"Add New Job"**, or use **Live Job Search** to discover real openings.
2. Ask me about any saved opening once added to your database!

*(Generated using CareerPilot Deterministic Agent Planner)*`
    };
  }

  // Identify target job from user query or select the first job
  const specificJobMatch = userText.match(/job\s+(\d+)/i) || userText.match(/job\s+id\s+(\d+)/i);
  let targetJobId = specificJobMatch ? parseInt(specificJobMatch[1], 10) : (jobsList[0]?.id || 1);

  // 5. Calculate Job Match
  if (!executedNames.has('calculateJobMatch')) {
    return {
      tool_calls: [{
        id: `call_${Date.now()}_match`,
        type: 'function',
        function: {
          name: 'calculateJobMatch',
          arguments: JSON.stringify({ jobId: targetJobId, candidateId: profile.candidateId })
        }
      }]
    };
  }

  const matchTool = executedTools.find(t => t.name === 'calculateJobMatch');
  const matchData = matchTool ? matchTool.data : {};

  // 6. Generate Interview Questions if requested or if looking for comprehensive prep
  const isInterviewPrepReq = userText.includes('interview') || userText.includes('question') || userText.includes('prep') || userText.includes('prepare');
  if (isInterviewPrepReq && !executedNames.has('generateInterviewQuestions')) {
    return {
      tool_calls: [{
        id: `call_${Date.now()}_interview`,
        type: 'function',
        function: {
          name: 'generateInterviewQuestions',
          arguments: JSON.stringify({ jobId: targetJobId, candidateId: profile.candidateId })
        }
      }]
    };
  }

  // 7. Save Job Analysis
  if (!executedNames.has('saveJobAnalysis') && matchData && matchData.matchScore !== undefined) {
    return {
      tool_calls: [{
        id: `call_${Date.now()}_save`,
        type: 'function',
        function: {
          name: 'saveJobAnalysis',
          arguments: JSON.stringify({
            jobId: targetJobId,
            candidateId: profile.candidateId,
            matchScore: matchData.matchScore,
            matchedSkills: matchData.matchedSkills || [],
            missingSkills: matchData.missingSkills || [],
            keyStrengths: matchData.keyStrengths || [],
            recommendations: matchData.recommendations || ['Review core requirements'],
            interviewReadiness: matchData.interviewReadiness || 'Moderate'
          })
        }
      }]
    };
  }

  // 8. Final Response Synthesis using Real Data
  const interviewTool = executedTools.find(t => t.name === 'generateInterviewQuestions');
  const interview = interviewTool ? interviewTool.data : null;

  let responseMarkdown = `### 🎯 Career Compatibility Evaluation

Hello **${profile.name}**, here is the comprehensive evaluation of your profile against **${matchData.jobTitle || 'Target Role'}** at **${matchData.company || 'Company'}**:

#### 📊 Match Assessment: **${matchData.matchScore}% Match** (\`${matchData.interviewReadiness} Readiness\`)
*${matchData.matchExplanation || 'Calculated based on verified candidate skills against job requirements.'}*

- **Matched Skills (${matchData.matchedSkillsCount || matchData.matchedSkills?.length || 0})**: ${matchData.matchedSkills?.map(s => `\`${s}\``).join(', ') || 'None identified'}
- **Missing Requirements (${matchData.missingSkills?.length || 0})**: ${matchData.missingSkills?.length > 0 ? matchData.missingSkills.map(s => `\`${s}\``).join(', ') : '✨ None! You satisfy all explicit core requirements.'}

#### 📚 Recommended Learning Skills (Gap Priorities):
${matchData.recommendedLearningSkills && matchData.recommendedLearningSkills.length > 0 ? matchData.recommendedLearningSkills.map(s => `- **${s.skill}**: ${s.action}`).join('\n') : '- No immediate skill gaps detected for this role.'}
*(Note: Recommended skills are suggestions only and will never be added to your profile without your explicit action.)*

#### 💡 Strategic Preparation Advice:
${matchData.recommendations?.map(r => `- ${r}`).join('\n') || '- Align your project examples with the core responsibilities.'}
`;

  if (interview) {
    responseMarkdown += `\n### 🎙️ Tailored Interview Preparation

#### 1. Core Technical Questions:
${interview.technicalQuestions?.map((q, idx) => `${idx + 1}. **${q.question}**\n   - *Key Talking Points:* ${q.talkingPoints}`).join('\n\n')}

#### 2. Behavioral Questions (STAR Method):
${interview.behavioralQuestions?.map((q, idx) => `${idx + 1}. **${q.question}**\n   - *Framework:* ${q.starFramework}`).join('\n\n')}

#### 3. Strategic Interview Advice:
${interview.candidateTips?.map(t => `- ${t}`).join('\n')}
`;
  }

  responseMarkdown += `\n*Evaluation audit saved to database. Generated by CareerPilot Deterministic Agent Planner with tool execution.*`;

  return { content: responseMarkdown };
}

module.exports = {
  callLLM
};
