/**
 * Authentication REST API Routes
 */

const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, createAuthRateLimiter } = require('../middleware/authMiddleware');

const env = require('../config/env');

const router = express.Router();
const defaultMaxAttempts = env.isProduction ? 10 : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10);
const authLimiter = createAuthRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: defaultMaxAttempts });

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;
