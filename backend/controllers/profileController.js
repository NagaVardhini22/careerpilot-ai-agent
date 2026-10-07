/**
 * Candidate Profile Controller
 */

const profileService = require('../services/profileService');

async function getProfile(req, res, next) {
  try {
    const candidateId = req.query.candidateId ? parseInt(req.query.candidateId, 10) : null;
    const profile = await profileService.getActiveProfile(candidateId);
    return res.json({
      success: true,
      profile // Returns null if no candidate profile has been created yet (clean state)
    });
  } catch (error) {
    next(error);
  }
}

async function createProfile(req, res, next) {
  try {
    const profile = await profileService.createProfile(req.body);
    return res.status(201).json({
      success: true,
      message: 'Candidate profile created successfully.',
      profile
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const candidateId = parseInt(req.params.id || req.body.candidateId || '1', 10);
    const profile = await profileService.updateProfile(candidateId, req.body);
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      profile
    });
  } catch (error) {
    next(error);
  }
}

async function getSkillsCatalog(req, res, next) {
  try {
    const skills = await profileService.getAllSkills();
    return res.json({
      success: true,
      count: skills.length,
      skills
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  createProfile,
  updateProfile,
  getSkillsCatalog
};
