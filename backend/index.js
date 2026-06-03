const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Validate required env vars at startup
const required = ['JWT_SECRET', 'ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} environment variable is not set`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (Railway runs behind a reverse proxy)
app.set('trust proxy', 1);

// Serve widget.js BEFORE Helmet so it's not blocked by CORP/CSP on client sites
app.use('/widget.js', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'public'), { index: false }));

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — allow any origin so the embeddable widget works on client sites
// Auth-protected endpoints are secured by JWT, not CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiters
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait a moment." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many attempts. Please try again later." }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'WhiteLabelAI Backend Running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rate limiter for document operations (scraping, uploads)
const docLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests. Please wait a moment." }
});

// Rate limiter for public lead submission
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Too many requests. Please wait a moment." }
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/chat', chatLimiter, require('./routes/chat'));
app.use('/api/documents', docLimiter, require('./routes/documents'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/leads', leadLimiter, require('./routes/leads'));

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
