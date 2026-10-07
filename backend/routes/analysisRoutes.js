/**
 * Analysis, Applications, and System Utility Routes
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

router.get('/analyses', analysisController.getAnalyses);
router.get('/analyses/:id', analysisController.getAnalysisById);
router.get('/applications', analysisController.getApplications);
router.get('/stats', analysisController.getStats);
router.post('/demo/seed', analysisController.seedDemoData);
router.post('/demo/reset', analysisController.resetDatabase);

module.exports = router;
