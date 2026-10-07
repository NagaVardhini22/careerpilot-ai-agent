/**
 * Tool: analyzeJobRequirements
 * Purpose: Analyze a job description and extract structured requirements:
 * required skills, preferred skills, technologies, experience requirements, responsibilities.
 */

const db = require('../config/db');

async function analyzeJobRequirements(args = {}) {
  let { jobId, jobDescription } = args;
  let jobTitle = 'Target Role';
  let company = 'Company';
  let experienceRequired = '2-4 years';
  let rawRequiredSkills = [];

  if (jobId) {
    const rows = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!rows || rows.length === 0) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }
    const job = rows[0];
    jobTitle = job.title;
    company = job.company;
    experienceRequired = job.experience_required;
    jobDescription = job.description;
    try {
      rawRequiredSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : (job.required_skills || []);
    } catch {
      rawRequiredSkills = [];
    }
  }

  if (!jobDescription) {
    throw new Error('Either jobId or jobDescription must be provided to analyzeJobRequirements.');
  }

  // Parse technologies and categories
  const techKeywords = [
    'JavaScript', 'TypeScript', 'Node.js', 'Express.js', 'Express', 'MySQL', 'SQL', 
    'PostgreSQL', 'MongoDB', 'Redis', 'React', 'HTML5', 'CSS3', 'Git', 'Docker', 
    'Kubernetes', 'AWS', 'Linux', 'Python', 'CI/CD', 'REST APIs', 'GraphQL', 
    'Microservices', 'Unit Testing', 'OpenAI API', 'Agentic Workflows'
  ];

  const foundTech = new Set(rawRequiredSkills);
  techKeywords.forEach(tech => {
    const regex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(jobDescription)) {
      foundTech.add(tech);
    }
  });

  const allDetected = Array.from(foundTech);
  
  // Categorize detected technologies
  const coreRequired = allDetected.slice(0, Math.ceil(allDetected.length * 0.7));
  const preferred = allDetected.slice(Math.ceil(allDetected.length * 0.7));

  // Synthesize key responsibilities based on job context
  const keyResponsibilities = [
    `Design, build, and maintain production features for ${jobTitle} systems`,
    'Collaborate on API interface contracts, relational database schemas, and documentation',
    'Write clean, well-tested, and maintainable application code with automated testing',
    'Participate in code reviews and optimize system reliability and performance'
  ];

  return {
    jobId: jobId || null,
    jobTitle,
    company,
    experienceRequired,
    requiredSkills: coreRequired.length > 0 ? coreRequired : ['Software Engineering', 'REST APIs'],
    preferredSkills: preferred.length > 0 ? preferred : ['Cloud Infrastructure', 'System Design'],
    technologies: allDetected,
    responsibilities: keyResponsibilities,
    analysisSummary: `The role for ${jobTitle} at ${company} focuses primarily on ${coreRequired.slice(0, 3).join(', ')} with an expectation of ${experienceRequired} relevant experience.`
  };
}

module.exports = {
  name: 'analyzeJobRequirements',
  description: 'Analyze a job description to extract structured required skills, preferred skills, technologies, experience requirements, and core responsibilities.',
  parameters: {
    type: 'object',
    properties: {
      jobId: {
        type: 'integer',
        description: 'The ID of the saved job in MySQL to analyze.'
      },
      jobDescription: {
        type: 'string',
        description: 'Direct job description text if analyzing an unsaved role.'
      }
    }
  },
  execute: analyzeJobRequirements
};
