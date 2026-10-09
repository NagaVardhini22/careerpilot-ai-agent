/**
 * Authentication REST API Routes
 */

const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, createAuthRateLimiter } = require('../middleware/authMiddleware');

const router = express.Router();
const authLimiter = createAuthRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 10 });

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;
