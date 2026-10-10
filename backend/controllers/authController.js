/**
 * Authentication Controller
 */

const authService = require('../services/authService');
const env = require('../config/env');

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/'
  };
}

function setAuthCookie(res, token) {
  res.cookie(env.auth.cookieName, token, {
    ...getCookieOptions(),
    maxAge: env.auth.tokenExpiresInHours * 3600 * 1000
  });
}

async function register(req, res, next) {
  try {
    const rawName = req.body && (req.body.name !== undefined ? req.body.name : (req.body.fullName || req.body.username));
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const name = typeof rawName === 'string' ? rawName.trim() : rawName;
    const { user, token } = await authService.registerUser({ name, email, password });

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user,
      token // Provided for automated testing / non-browser clients
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('quarantined')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('required') || error.message.includes('at least 8 characters')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.loginUser({ email, password });

    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user,
      token
    });
  } catch (error) {
    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({ success: false, error: error.message });
    }
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie(env.auth.cookieName, getCookieOptions());
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

async function getCurrentUser(req, res, next) {
  try {
    const userDetails = await authService.getUserById(req.user.id);
    if (!userDetails) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.json({
      success: true,
      user: {
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
        createdAt: userDetails.created_at,
        lastLogin: userDetails.last_login
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser
};
