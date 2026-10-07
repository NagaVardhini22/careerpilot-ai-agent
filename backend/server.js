/**
 * CareerPilot - Express Server Entry Point
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { testConnection } = require('./config/db');

// Route Handlers
const profileRoutes = require('./routes/profileRoutes');
const jobRoutes = require('./routes/jobRoutes');
const agentRoutes = require('./routes/agentRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Health Check API
app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: 'online',
    appName: 'CareerPilot AI Career Agent',
    databaseConnected: dbOk,
    aiProvider: env.ai.provider,
    timestamp: new Date().toISOString()
  });
});

// REST API Routes
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api', analysisRoutes);

// Fallback to index.html for single-page application navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server
async function startServer() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('⚠️ Warning: MySQL database connection check failed on startup. Verify credentials in .env.');
  } else {
    console.log('✅ MySQL Database connection established.');
  }

  app.listen(env.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 CareerPilot AI Agent Server is live!`);
    console.log(`📡 URL: http://localhost:${env.port}`);
    console.log(`🤖 AI Provider: ${env.ai.provider.toUpperCase()} (Model: ${env.ai.model})`);
    console.log(`💾 Database: ${env.db.name}@${env.db.host}:${env.db.port}`);
    console.log(`====================================================`);
  });
}

startServer();

module.exports = app;
