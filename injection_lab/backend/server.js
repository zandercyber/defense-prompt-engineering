require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Persistent in-memory score store: username → { username, bestScore, attempts, lastUpdated }
const scores = new Map();

// Professor is always rank 1 with a perfect score
scores.set('Professor', {
  username: 'Professor',
  bestScore: 100,
  attempts: 1,
  lastUpdated: new Date().toISOString(),
});

// POST /api/auth — password check
app.post('/api/auth', (req, res) => {
  const { username, password } = req.body;
  console.log('[AUTH] login attempt for username:', username);
  if (password === process.env.LAB_PASSWORD) {
    console.log('[AUTH] success for:', username);
    res.json({ success: true, username });
  } else {
    console.log('[AUTH] failed for:', username);
    res.status(401).json({ success: false, message: 'Wrong password' });
  }
});

// GET /api/scores — top 10 defenders sorted by bestScore desc
app.get('/api/scores', (req, res) => {
  console.log('[SCORES GET] scores map size:', scores.size);
  const top10 = Array.from(scores.values())
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 10)
    .map((entry, i) => ({
      rank: i + 1,
      username: entry.username,
      bestScore: entry.bestScore,
      attempts: entry.attempts,
      lastUpdated: entry.lastUpdated,
    }));
  console.log('[SCORES GET] returning', top10.length, 'entries:', JSON.stringify(top10));
  res.json(top10);
});

// POST /api/scores — upsert student score (track best score per user)
app.post('/api/scores', (req, res) => {
  const { username, score } = req.body;
  console.log('[SCORES POST] received payload:', { username, score });

  if (!username || score === undefined || score === null) {
    console.error('[SCORES POST] invalid payload — missing username or score');
    return res.status(400).json({ error: 'username and score required' });
  }

  const numScore = Number(score);
  if (isNaN(numScore)) {
    console.error('[SCORES POST] score is not a number:', score);
    return res.status(400).json({ error: 'score must be a number' });
  }

  // Never override Professor's seeded entry
  if (username === 'Professor') {
    console.log('[SCORES POST] ignoring update for reserved username Professor');
    return res.json({ success: true, rank: 1, bestScore: 100 });
  }

  const existing = scores.get(username) || { username, bestScore: 0, attempts: 0 };
  existing.attempts++;
  if (numScore > existing.bestScore) {
    console.log('[SCORES POST] new best score for', username, ':', numScore, '(was', existing.bestScore, ')');
    existing.bestScore = numScore;
  } else {
    console.log('[SCORES POST] score', numScore, 'does not beat existing best', existing.bestScore, 'for', username);
  }
  existing.lastUpdated = new Date().toISOString();
  scores.set(username, existing);

  const sorted = Array.from(scores.values())
    .sort((a, b) => b.bestScore - a.bestScore);
  const rank = sorted.findIndex(s => s.username === username) + 1;

  console.log('[SCORES POST] saved — username:', username, 'bestScore:', existing.bestScore, 'attempts:', existing.attempts, 'rank:', rank);
  res.json({ success: true, rank, bestScore: existing.bestScore });
});

// POST /api/claude — proxy to Anthropic API (model and parameters locked server-side)
app.post('/api/claude', async (req, res) => {
  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages,
  };

  console.log('[CLAUDE] proxying request, model locked to:', payload.model);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log('[CLAUDE] Anthropic responded with status:', response.status);
    res.json(data);
  } catch (err) {
    console.error('[CLAUDE] proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Static files AFTER API routes so /api/* never hits the file handler
app.use(express.static('public'));

// 404 catch-all — always JSON, never HTML
app.use((req, res) => {
  console.log('[404] Unhandled route:', req.method, req.url);
  res.status(404).json({ error: 'Not found' });
});

app.listen(3000, () => console.log('[STARTUP] Backend running at http://localhost:3000'));
