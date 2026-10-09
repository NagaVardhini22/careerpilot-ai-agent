/**
 * Agent Routes
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/run', requireAuth, agentController.runAgent);
router.get('/runs', requireAuth, agentController.getRuns);
router.get('/runs/:id', requireAuth, agentController.getRunById);

module.exports = router;
