/**
 * Candidate Profile Controller
 * Derives user ID strictly from server authentication context.
 */

const profileService = require('../services/profileService');

async function getProfile(req, res, next) {
  try {
    const candidateId = req.query.candidateId ? parseInt(req.query.candidateId, 10) : null;
    const profile = await profileService.getActiveProfile(req.user.id, candidateId);
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
    const profile = await profileService.createProfile(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Candidate profile created successfully.',
      profile
    });
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('cannot be negative') || error.message.includes('required') || error.message.includes('between 1950')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const candidateId = parseInt(req.params.id || req.body.candidateId, 10);
    if (!candidateId || isNaN(candidateId)) {
      return res.status(400).json({ success: false, error: 'A valid candidate profile ID is required.' });
    }

    const profile = await profileService.updateProfile(candidateId, req.body, req.user.id);
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      profile
    });
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('cannot be negative') || error.message.includes('required') || error.message.includes('between 1950')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('access denied') || error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
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
