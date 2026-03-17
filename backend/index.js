const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter on chat endpoint (20 requests per minute per IP)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait a moment." }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'WhiteLabelAI Backend Running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/chat', chatLimiter, require('./routes/chat'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/analytics', require('./routes/analytics'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Only listen when running directly (not on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\nWhiteLabelAI server running on port ${PORT}`);
    console.log(`   Local: http://localhost:${PORT}\n`);
  });
}

module.exports = app;
