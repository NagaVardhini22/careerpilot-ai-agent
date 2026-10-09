/**
 * Job Routes
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const jobSearchController = require('../controllers/jobSearchController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, jobController.getJobs);
router.post('/', requireAuth, jobController.createJob);

// External Job Discovery Endpoints (Mounted before :id parameter route)
router.get('/external/search', requireAuth, jobSearchController.searchLiveJobs);
router.get('/external/providers', requireAuth, jobSearchController.getProvidersStatus);
router.post('/external/save', requireAuth, jobSearchController.saveExternalJob);

router.get('/:id', requireAuth, jobController.getJobById);
router.delete('/:id', requireAuth, jobController.deleteJob);
router.post('/:id/analyze', requireAuth, jobController.analyzeJob);

module.exports = router;
