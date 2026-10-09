/**
 * Analysis, Applications, and System Utility Routes
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/analyses', requireAuth, analysisController.getAnalyses);
router.get('/analyses/:id', requireAuth, analysisController.getAnalysisById);
router.get('/applications', requireAuth, analysisController.getApplications);
router.get('/stats', requireAuth, analysisController.getStats);
router.post('/demo/seed', requireAuth, analysisController.seedDemoData);
router.post('/demo/reset', requireAuth, analysisController.resetDatabase);

module.exports = router;
