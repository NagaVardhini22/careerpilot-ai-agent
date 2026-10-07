/**
 * Tool: generateInterviewQuestions
 * Purpose: Generate structured interview questions based on job description,
 * candidate skills, missing skills, and job requirements.
 */

const db = require('../config/db');

async function generateInterviewQuestions(args = {}) {
  let { jobId, candidateId, focusArea } = args;

  // Resolve candidateId if omitted
  if (!candidateId) {
    const defaultProfile = await db.query('SELECT id FROM candidate_profiles ORDER BY id ASC LIMIT 1');
    if (defaultProfile.length > 0) {
      candidateId = defaultProfile[0].id;
    } else {
      throw new Error('No candidate profile found. Please create your profile first.');
    }
  }

  // Resolve jobId if omitted
  if (!jobId) {
    const defaultJob = await db.query('SELECT id FROM jobs WHERE status = "saved" ORDER BY id ASC LIMIT 1');
    if (defaultJob.length > 0) {
      jobId = defaultJob[0].id;
    } else {
      throw new Error('No saved jobs found. Please add a job first to generate interview questions.');
    }
  }

  // 1. Fetch Job
  const jobRows = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
  if (!jobRows || jobRows.length === 0) {
    throw new Error(`Job with ID ${jobId} not found.`);
  }
  const job = jobRows[0];
  let requiredSkills = [];
  try {
    requiredSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : (job.required_skills || []);
  } catch {
    requiredSkills = [];
  }

  // 2. Fetch Latest Analysis or Calculate On-the-Fly
  const analysisRows = await db.query(
    'SELECT matched_skills, missing_skills, match_score FROM job_analyses WHERE job_id = ? AND candidate_id = ? ORDER BY created_at DESC LIMIT 1',
    [jobId, candidateId]
  );

  let matchedSkills = [];
  let missingSkills = [];
  if (analysisRows.length > 0) {
    try {
      matchedSkills = typeof analysisRows[0].matched_skills === 'string' ? JSON.parse(analysisRows[0].matched_skills) : analysisRows[0].matched_skills;
      missingSkills = typeof analysisRows[0].missing_skills === 'string' ? JSON.parse(analysisRows[0].missing_skills) : analysisRows[0].missing_skills;
    } catch {
      matchedSkills = requiredSkills.slice(0, 3);
      missingSkills = [];
    }
  } else {
    const candSkills = await db.query(
      'SELECT s.name FROM candidate_skills cs JOIN skills s ON cs.skill_id = s.id WHERE cs.candidate_id = ?',
      [candidateId]
    );
    const candSkillNames = new Set(candSkills.map(s => s.name.toLowerCase()));
    matchedSkills = requiredSkills.filter(s => candSkillNames.has(s.toLowerCase()));
    missingSkills = requiredSkills.filter(s => !candSkillNames.has(s.toLowerCase()));
  }

  const primarySkill = matchedSkills[0] || (requiredSkills[0] || 'Software Engineering');
  const secondarySkill = matchedSkills[1] || (requiredSkills[1] || 'System Design');

  // Technical Questions tailored to matched skills and the target role
  const technicalQuestions = [
    {
      skill: primarySkill,
      question: `How would you architect a scalable, maintainable solution using ${primarySkill} and ${secondarySkill} to meet production reliability standards?`,
      talkingPoints: `Discuss design patterns, error boundaries, performance bottlenecks, caching, and maintainability for ${primarySkill}.`
    },
    {
      skill: 'Architecture & Database Design',
      question: `When designing the persistence layer for ${job.title}, how do you evaluate normalization vs denormalization and transaction isolation levels?`,
      talkingPoints: 'Highlight data integrity, query optimization, indexing strategies, and locking tradeoffs.'
    },
    {
      skill: 'API Security & Engineering Hygiene',
      question: `What security controls and automated testing workflows do you implement before deploying critical web services?`,
      talkingPoints: 'Discuss input sanitization, parameterized queries, unit/integration test coverage, and CI/CD pipelines.'
    }
  ];

  // Behavioral Questions (STAR format)
  const behavioralQuestions = [
    {
      topic: 'Technical Disagreement & Collaboration',
      question: `Describe a scenario where you and a stakeholder differed on a technical decision or API specification for a role like ${job.title}. How did you reach alignment?`,
      starFramework: 'Situation (context), Task (objective), Action (objective benchmarks / trade-off analysis), Result (outcome).'
    },
    {
      topic: 'High-Impact Problem Solving',
      question: `Walk us through a complex engineering problem or performance bottleneck you resolved in your recent work.`,
      starFramework: 'Focus on root-cause diagnosis, reproducibility, measurable impact, and regression prevention.'
    }
  ];

  // Skill Gap Questions
  const skillGapQuestions = missingSkills.length > 0 ? missingSkills.map(skill => ({
    gapSkill: skill,
    question: `The job specification requests experience with ${skill}. How would you bridge this requirement with your existing skillset?`,
    strategy: `Acknowledge current familiarity, connect with your strengths in ${primarySkill}, and describe your accelerated onboarding plan.`
  })) : [
    {
      gapSkill: 'Advanced System Scaling',
      question: `Given that your skills match all direct core requirements, how would you approach high-availability clustering and distributed scaling for ${job.company}?`,
      strategy: 'Discuss horizontal scaling, resilience patterns (circuit breakers, retries), and telemetry monitoring.'
    }
  ];

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    focusArea: focusArea || 'Technical & Behavioral Rounds',
    technicalQuestions,
    behavioralQuestions,
    skillGapQuestions,
    candidateTips: [
      `Review ${job.company}'s mission and align your talking points with ${job.title} expectations.`,
      `Structure answers using trade-offs: explain why you chose an approach over plausible alternatives.`,
      `Demonstrate clear proficiency in ${matchedSkills.slice(0, 3).join(', ') || 'core engineering fundamentals'}.`
    ]
  };
}

module.exports = {
  name: 'generateInterviewQuestions',
  description: 'Generate tailored technical, behavioral, and skill-gap interview preparation questions for a specific job based on candidate qualifications.',
  parameters: {
    type: 'object',
    properties: {
      jobId: {
        type: 'integer',
        description: 'The ID of the job for which to generate interview questions.'
      },
      candidateId: {
        type: 'integer',
        description: 'Optional ID of the candidate profile. Defaults to active profile.'
      },
      focusArea: {
        type: 'string',
        description: 'Optional specific focus area, e.g. "technical", "behavioral", or "database".'
      }
    }
  },
  execute: generateInterviewQuestions
};
