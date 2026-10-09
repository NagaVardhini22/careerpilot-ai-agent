/**
 * Authentication Service
 * 
 * Implements:
 * - Secure password hashing using Node.js standard crypto.scrypt with timing-safe comparison.
 * - Cryptographically signed HMAC-SHA256 session tokens.
 * - Legacy data quarantine protection against email-matching hijacks.
 */

const crypto = require('crypto');
const util = require('util');
const db = require('../config/db');
const env = require('../config/env');

const scryptAsync = util.promisify(crypto.scrypt);

/**
 * Hash a password using scrypt with a random 16-byte salt and 64-byte key.
 * Format: "saltHex:derivedKeyHex"
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a plain password against the stored scrypt hash in constant time.
 */
async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(keyHex, 'hex');

  const derivedKey = await scryptAsync(password, salt, storedKey.length);
  return crypto.timingSafeEqual(derivedKey, storedKey);
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL decoding helper
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generate an HMAC-SHA256 signed bearer session token.
 */
function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const signature = crypto
    .createHmac('sha256', env.auth.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 bearer session token.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', env.auth.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Register a new user.
 * 
 * Safety requirement:
 * If an existing user matches the email but has password_hash = NULL (legacy unverified data),
 * registration is strictly REJECTED to prevent automatic hijacking of legacy records.
 */
async function registerUser({ name, email, password }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required.');
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check existing users
  const existing = await db.query('SELECT id, password_hash FROM users WHERE email = ?', [normalizedEmail]);

  if (existing.length > 0) {
    const userRecord = existing[0];
    if (userRecord.password_hash === null) {
      // Legacy unverified record: quarantine protection
      throw new Error(
        'An existing profile is associated with this email address. Account claiming requires administrator verification or email confirmation. Legacy data remains quarantined.'
      );
    }
    throw new Error('An account with this email address already exists. Please log in instead.');
  }

  // Hash password with scrypt
  const hashedPassword = await hashPassword(password);

  const result = await db.query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name.trim(), normalizedEmail, hashedPassword]
  );

  const userId = result.insertId;
  const user = { id: userId, name: name.trim(), email: normalizedEmail };

  const exp = Math.floor(Date.now() / 1000) + env.auth.tokenExpiresInHours * 3600;
  const token = generateToken({ userId, email: normalizedEmail, name: user.name, exp });

  return { user, token };
}

/**
 * Authenticate an existing user with email and password.
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const rows = await db.query(
    'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    [normalizedEmail]
  );

  // Return generic error message to prevent email enumeration
  if (rows.length === 0 || !rows[0].password_hash) {
    throw new Error('Invalid email or password.');
  }

  const userRecord = rows[0];
  const isMatch = await verifyPassword(password, userRecord.password_hash);

  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  // Update last_login timestamp for audit
  try {
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userRecord.id]);
  } catch {
    // Non-blocking if last_login column is not yet migrated
  }

  const user = { id: userRecord.id, name: userRecord.name, email: userRecord.email };
  const exp = Math.floor(Date.now() / 1000) + env.auth.tokenExpiresInHours * 3600;
  const token = generateToken({ userId: user.id, email: user.email, name: user.name, exp });

  return { user, token };
}

/**
 * Fetch public user details by ID.
 */
async function getUserById(id) {
  const rows = await db.query(
    'SELECT id, name, email, created_at, last_login FROM users WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById
};
