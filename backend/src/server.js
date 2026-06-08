require('dotenv').config();
const express = require('express');
const cors = require('cors');
const streamRouter = require('./routes/stream');
const skipRouter = require('./routes/skip');
const subtitlesRouter = require('./routes/subtitles');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET'],
}));
app.use(express.json());

// --- Health check ---
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- Routes ---
app.use('/api/stream', streamRouter);
app.use('/api/skip', skipRouter);
app.use('/api/subtitles', subtitlesRouter);

// --- Global error handler ---
app.use((err, req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
});
