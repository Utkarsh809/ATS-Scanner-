'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { config } = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // Render/Railway sit behind a proxy
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Basic abuse protection: auth endpoints are stricter.
app.use('/api/', rateLimit({ windowMs: 60 * 1000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(
  '/api/auth/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
  })
);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    services: {
      semantic: config.hf.token ? 'huggingface' : 'local',
      rewrites: config.gemini.apiKey ? 'gemini' : 'local',
    },
    weights: config.weights,
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scans', require('./routes/scans'));
app.use('/api/account', require('./routes/account'));

app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
