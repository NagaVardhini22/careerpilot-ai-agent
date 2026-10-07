/**
 * Agent Routes
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

router.post('/run', agentController.runAgent);
router.get('/runs', agentController.getRuns);
router.get('/runs/:id', agentController.getRunById);

module.exports = router;
