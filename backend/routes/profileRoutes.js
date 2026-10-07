/**
 * Candidate Profile Routes
 */

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/', profileController.getProfile);
router.post('/', profileController.createProfile);
router.put('/:id?', profileController.updateProfile);
router.get('/skills', profileController.getSkillsCatalog);

module.exports = router;
