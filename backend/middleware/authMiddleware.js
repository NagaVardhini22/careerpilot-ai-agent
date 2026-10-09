/**
 * Authentication & Security Middleware
 * 
 * Implements:
 * - Cookie parsing without third-party dependencies.
 * - HTTP-only session token verification.
 * - CSRF mitigation for cookie-based state-changing requests.
 * - Server-side authentication enforcement (requireAuth).
 * - Rate limiting on authentication routes.
 */

const { verifyToken } = require('../services/authService');
const env = require('../config/env');

/**
 * Lightweight cookie parser middleware
 */
function cookieParserMiddleware(req, res, next) {
  const list = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }

  req.cookies = list;
  next();
}

/**
 * Global token authentication middleware.
 * Attaches req.user if a valid token is present (via cookie or Bearer header).
 */
function authenticateToken(req, res, next) {
  req.user = null;

  let token = null;
  let tokenSource = null;

  // 1. Check HTTP-only cookie first (browser preference)
  if (req.cookies && req.cookies[env.auth.cookieName]) {
    token = req.cookies[env.auth.cookieName];
    tokenSource = 'cookie';
  }

  // 2. Fall back to Authorization: Bearer <token> (API/testing support)
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
    tokenSource = 'bearer';
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.userId) {
      req.user = {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        tokenSource
      };
    }
  }

  next();
}

/**
 * Guard middleware requiring an active authenticated user.
 * Enforces CSRF protection for cookie-authenticated mutating requests.
 */
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to continue.'
    });
  }

  // CSRF Protection: For state-changing requests using cookie authentication,
  // require the custom X-Requested-With header to prevent cross-site request forgery.
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (req.user.tokenSource === 'cookie' && mutatingMethods.includes(req.method)) {
    const requestedWith = req.headers['x-requested-with'];
    if (!requestedWith || requestedWith.toLowerCase() !== 'xmlhttprequest') {
      return res.status(403).json({
        success: false,
        error: 'CSRF validation failed: Missing required X-Requested-With header on state-changing request.'
      });
    }
  }

  next();
}

/**
 * In-memory IP-based rate limiter for login and registration endpoints.
 */
function createAuthRateLimiter({ windowMs = 15 * 60 * 1000, maxAttempts = 10 } = {}) {
  const attempts = new Map();

  // Periodic cleanup of stale IPs
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts.entries()) {
      if (now - record.startTime > windowMs) {
        attempts.delete(ip);
      }
    }
  }, windowMs).unref();

  return function authRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    const now = Date.now();

    const record = attempts.get(ip) || { count: 0, startTime: now };

    if (now - record.startTime > windowMs) {
      record.count = 1;
      record.startTime = now;
    } else {
      record.count++;
    }

    attempts.set(ip, record);

    if (record.count > maxAttempts) {
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again after 15 minutes.'
      });
    }

    next();
  };
}

module.exports = {
  cookieParserMiddleware,
  authenticateToken,
  requireAuth,
  createAuthRateLimiter
};
