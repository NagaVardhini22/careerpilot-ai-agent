/**
 * Job Routes
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.get('/', jobController.getJobs);
router.post('/', jobController.createJob);
router.get('/:id', jobController.getJobById);
router.delete('/:id', jobController.deleteJob);
router.post('/:id/analyze', jobController.analyzeJob);

module.exports = router;
