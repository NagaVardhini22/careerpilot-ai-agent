/**
 * Candidate Profile Routes
 */

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, profileController.getProfile);
router.post('/', requireAuth, profileController.createProfile);
router.put('/:id?', requireAuth, profileController.updateProfile);
router.get('/skills', profileController.getSkillsCatalog);

module.exports = router;
