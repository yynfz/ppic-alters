/**
 * PPIC Alter-S — HTTP layer
 *
 *   Browser  ──SSE──▶  Express  ──▶  agent.js  ──▶  engine.js (Python)
 *
 * The server never computes material quantities itself and never exposes a
 * write path to purchasing. It streams a read-only plan plus a draft PR.
 */

import './env.js'; // must be first: populates process.env from .env

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTurn, ensureAgent, agentStatus } from './agent.js';
import { demoData, computePlan, dataSource } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const agent = agentStatus();
  res.json({
    status: 'ok',
    service: 'PPIC Alter-S',
    agent: {
      mode: agent.mode, // 'sdk' | 'offline' | 'unknown'
      reason: agent.reason,
      verified: agent.verified,
    },
    dataSource: dataSource(), // 'supabase' | 'csv'
  });
});

// ─── Demo data (read-only) ───────────────────────────────────────────────────

app.get('/api/demo-data', async (req, res) => {
  try {
    res.json(await demoData());
  } catch (err) {
    res.status(500).json({ error: `Could not read demo data: ${err.message}` });
  }
});

// ─── Deterministic plan endpoint (used by the UI for direct checks) ──────────

app.get('/api/plan/:orderId', async (req, res) => {
  const result = await computePlan(req.params.orderId);
  if (!result.ok) {
    return res.status(404).json({ error: result.error, code: result.code });
  }
  res.json(result.plan);
});

// ─── Chat (SSE) ──────────────────────────────────────────────────────────────

// One SDK session cannot serve two turns at once; serialise them.
let turnChain = Promise.resolve();

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message ?? '').trim();

  if (!message) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  if (message.length > 2000) {
    return res.status(413).json({ error: 'Message is too long (max 2000 characters).' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const send = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const run = async () => {
    const started = Date.now();
    let mode = 'offline';
    let sawProgress = false;

    // A misconfigured credential can make the CLI retry for a while before it
    // reports back. Tell the planner something is happening rather than leaving
    // a silent typing indicator.
    const slowTimer = setTimeout(() => {
      if (!sawProgress) {
        send('status', {
          phase: 'thinking',
          message: 'Still working — the model is taking longer than usual…',
        });
      }
    }, 15000);

    try {
      // Resolve the agent first so the UI can state which mode is answering.
      await ensureAgent();
      const current = agentStatus();
      send('mode', { mode: current.mode, reason: current.reason, verified: current.verified });

      send('status', { phase: 'thinking', message: 'Working through the order…' });

      for await (const event of runTurn(message)) {
        if (closed) break;

        if (event.type === 'status') {
          send('status', { phase: 'thinking', message: event.message });
        } else if (event.type === 'tool_start') {
          sawProgress = true;
          send('tool_start', { id: event.id, name: event.name, input: event.input ?? null });
        } else if (event.type === 'tool_result') {
          send('tool_result', {
            id: event.id,
            ok: event.ok,
            error: event.error ?? null,
          });
        } else if (event.type === 'plan') {
          sawProgress = true;
          send('plan', { plan: event.plan });
        } else if (event.type === 'text') {
          sawProgress = true;
          send('text', { text: event.text });
        } else if (event.type === 'text_delta') {
          sawProgress = true;
          send('text_delta', { text: event.text });
        } else if (event.type === 'error') {
          send('error', { error: event.error });
        }
      }

      const final = agentStatus();
      mode = final.mode === 'sdk' ? 'sdk' : 'offline';
      send('done', { mode, verified: final.verified, elapsed_ms: Date.now() - started });
    } catch (err) {
      console.error('[PPIC] Turn failed:', err);
      send('error', {
        error: `Something went wrong while handling that request: ${err.message}`,
      });
      send('done', { mode, elapsed_ms: Date.now() - started });
    } finally {
      clearTimeout(slowTimer);
      if (!closed) res.end();
    }
  };

  // Chain turns so a shared session never processes two messages at once.
  const previous = turnChain;
  let release;
  turnChain = new Promise((resolve) => {
    release = resolve;
  });

  try {
    await previous;
    await run();
  } finally {
    release();
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  PPIC Alter-S — Agentic Production Planning & Inventory Intelligence');
  console.log(`  http://localhost:${PORT}`);
  console.log('');

  // Warm the agent so the first question does not pay the connect cost.
  ensureAgent().then((agent) => {
    console.log(
      agent.mode === 'sdk'
        ? '  Agent mode: CodeBuddy SDK session ready'
        : `  Agent mode: deterministic fallback — ${agent.reason}`
    );
  });
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`\n[PPIC] ${signal} received, shutting down.`);
    process.exit(0);
  });
}
