/**
 * Environment Configuration
 * Validates and provides typed access to environment variables.
 */

require('dotenv').config();

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
let jwtSecret = process.env.JWT_SECRET || '';

// Production Security Guard: Require explicit strong JWT_SECRET
if (isProduction) {
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'default_secret' || jwtSecret.includes('change_me')) {
    console.error('FATAL: In production (NODE_ENV=production), JWT_SECRET must be explicitly configured with a strong secret of at least 32 characters.');
    process.exit(1);
  }
} else if (!jwtSecret) {
  // In development/test, provide a stable fallback key if not set in .env
  jwtSecret = 'dev_local_jwt_secret_careerpilot_at_least_32_chars_long!';
}

const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  db: {
    url: process.env.DATABASE_URL || process.env.MYSQL_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'careerpilot_db',
    ssl: process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true' || false,
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  },
  auth: {
    jwtSecret,
    cookieName: 'careerpilot_session',
    tokenExpiresInHours: 24,
    adminApiKey: process.env.ADMIN_API_KEY || ''
  },
  ai: {
    provider: (process.env.LLM_PROVIDER || 'mock').toLowerCase(),
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  }
};

module.exports = env;
