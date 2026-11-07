/**
 * PPIC Alter-S — Agentic Production Planning and Inventory Intelligence
 *
 * Backend server built with CodeBuddy Agent SDK.
 *
 * Architecture:
 *   Browser (chat UI)  ←─ SSE ─→  Express Server  ←─ Session API ─→  CodeBuddy Agent
 *
 * The agent is given:
 *   1. A system prompt that defines its role, rules, and guardrails.
 *   2. A custom MCP tool `compute_material_plan` that runs the deterministic
 *      Python script (compute_shortage.py) — ensuring calculations are NEVER
 *      invented by the AI. All numbers come from the verified script.
 *   3. Read/Bash/Glob tools so it can inspect demo data files.
 *
 * Rules enforced by design:
 *   - The agent CANNOT compute shortages itself — it MUST call the MCP tool,
 *     which delegates to the deterministic Python script.
 *   - The script never fabricates data; unknown orders return an honest error.
 *   - No purchase is ever executed; only a PENDING_HUMAN_APPROVAL draft is produced.
 */

import express from 'express';
import { unstable_v2_createSession } from '@tencent-ai/agent-sdk';
import { createSdkMcpServer, tool } from '@tencent-ai/agent-sdk';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'demo-data');
const COMPUTE_SCRIPT = path.join(__dirname, 'compute_shortage.py');

// ─── PPIC Alter-S System Prompt ───────────────────────────────────────────────
const PPIC_SYSTEM_PROMPT = `You are **PPIC Alter-S**, an Agentic Production Planning and Inventory Intelligence assistant for a manufacturing planner.

## Your Role
You help production planners answer questions like:
- "Can we produce 500 units of Product A for order MO-001?"
- "Do we have enough materials for order MO-002?"
- "What materials are short for MO-001?"

## How You Work
When a planner asks about producing an order, you MUST:
1. Call the \`compute_material_plan\` tool with the order ID. This tool runs a deterministic calculation script that reads the production order, Bill of Materials (BOM), and inventory — and computes exact material requirements.
2. Present the results clearly: a material plan table showing required, available, and shortage for each material.
3. If there are shortages, present the draft Purchase Request (PR) for human review.

## Deterministic Calculation Rules (enforced by the tool, not by you)
- required  = BOM qty_per_unit × production quantity
- available = max(on_hand − reserved, 0)
- shortage  = max(required − available, 0)
- Purchase request draft includes ONLY materials with shortage > 0
- PR status is always PENDING_HUMAN_APPROVAL — never auto-approved

## CRITICAL Guardrails — Never Violate These
1. **Never invent BOM or stock numbers.** All numbers MUST come from the \`compute_material_plan\` tool. If you haven't called the tool, you don't have the numbers.
2. **Never execute a purchase or create a real purchase order.** You only prepare a DRAFT PR for human review. The status is always PENDING_HUMAN_APPROVAL.
3. **If the order does not exist**, the tool will return an error. Report this honestly to the planner — do NOT fabricate data or make up numbers.
4. **All demo data is synthetic** — invented for demonstration. Mention this when relevant.
5. Always present the material plan as a clear markdown table.
6. When presenting the PR draft, clearly state it is a DRAFT requiring human approval.

## Output Format
After calling the tool, present results in this structure:

**Material Plan for [Order ID]** ([Product Name], [Quantity] [unit])

| Material | BOM/unit | Required | On-hand | Reserved | Available | Shortage |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

Then, if there are shortages:

**Draft Purchase Request: [PR-ID]**
- Status: PENDING_HUMAN_APPROVAL
- Lines:
  - [Material ID] ([Material Name]): [quantity] [unit]
- Note: This is a DRAFT only. No purchase has been made. A human must review and approve before any PO is created.

If no shortages:
"No material shortage for this order — no purchase request needed."

## Conversation
You support multi-turn conversation. The planner may ask follow-up questions about the same order or a different one. Always call the tool for each query to get fresh, accurate data.`;

// ─── Custom MCP Tool: compute_material_plan ───────────────────────────────────
// This tool delegates to the deterministic Python script, ensuring the AI
// never computes or invents numbers. The script reads real demo data files.

const computeMaterialPlanTool = tool(
  'compute_material_plan',
  `Compute the deterministic material plan for a production order.

This tool reads the production order, Bill of Materials (BOM), and inventory
from the demo-data directory, then computes exact material requirements using
fixed arithmetic rules:

  required  = BOM qty_per_unit × production quantity
  available = max(on_hand − reserved, 0)
  shortage  = max(required − available, 0)

If there are shortages, a draft Purchase Request (PR) is generated with
status PENDING_HUMAN_APPROVAL — never auto-approved.

If the order ID is not found, returns an honest error without fabricating data.

All data is SYNTHETIC DEMO DATA.`,
  {
    order_id: z.string().describe('Production order ID, e.g. "MO-001"'),
  },
  async (args) => {
    const orderId = args.order_id?.trim();
    if (!orderId) {
      return {
        content: [{ type: 'text', text: 'ERROR: order_id is required.' }],
        isError: true,
      };
    }

    try {
      const { stdout, stderr } = await execFileAsync('python3', [
        COMPUTE_SCRIPT,
        orderId,
        '--data-dir', DATA_DIR,
        '--json',
        '--no-write',
      ], {
        timeout: 15000,
        cwd: PROJECT_ROOT,
      });

      // The script prints JSON to stdout on success
      return {
        content: [{ type: 'text', text: stdout.trim() }],
      };
    } catch (err) {
      // Exit code 2 = data/input error (unknown order, etc.) — honest error
      const errMsg = (err.stderr || err.message || '').trim();
      return {
        content: [{ type: 'text', text: `ERROR: ${errMsg}` }],
        isError: true,
      };
    }
  }
);

const ppicMcpServer = createSdkMcpServer({
  name: 'ppic-alters',
  version: '1.0.0',
  tools: [computeMaterialPlanTool],
});

// ─── Session Management ───────────────────────────────────────────────────────
// We maintain one shared session for multi-turn conversation.
// The Session API keeps conversation context across messages.

let session = null;
let sessionInitPromise = null;

async function getSession() {
  if (session) return session;
  if (sessionInitPromise) return sessionInitPromise;

  sessionInitPromise = (async () => {
    console.log('[PPIC] Creating CodeBuddy Agent session...');

    // Use a separate config directory for the SDK-spawned CLI to avoid
    // port conflicts with the host CodeBuddy session's control server.
    const sdkConfigDir = path.join(PROJECT_ROOT, '.codebuddy-sdk');
    fs.mkdirSync(sdkConfigDir, { recursive: true });

    // The host CLI process writes its control-server port to
    // web-ui-port.json. If the SDK CLI reads the same file, it tries to
    // bind the same port and fails with EADDRINUSE. We pre-create a
    // web-ui-port.json in the isolated config dir with port 0, which tells
    // the CLI to pick a random free port instead.
    const portFile = path.join(sdkConfigDir, 'web-ui-port.json');
    if (!fs.existsSync(portFile)) {
      fs.writeFileSync(portFile, JSON.stringify({ ports: [0], port: 0, updatedAt: 0 }));
    }

    const s = unstable_v2_createSession({
      model: process.env.PPIC_MODEL || undefined, // use default model
      cwd: PROJECT_ROOT,
      systemPrompt: PPIC_SYSTEM_PROMPT,
      permissionMode: 'acceptEdits',
      maxTurns: 20,
      includePartialMessages: true,
      mcpServers: {
        'ppic-alters': ppicMcpServer,
      },
      allowedTools: [
        'Read',
        'Glob',
        'Bash',
        'mcp__ppic-alters__compute_material_plan',
      ],
      env: {
        // Isolate CLI config to avoid control-server port collision
        CODEBUDDY_CONFIG_DIR: sdkConfigDir,
        // Disable prewarm socket (not needed for SDK usage)
        CODEBUDDY_CODE_PREWARM_SOCKET_PATH: '',
        // Override the host session's SERVER__PORT — the SDK CLI must not
        // try to bind the same port as the host CodeBuddy process.
        // Setting to 0 lets the OS pick a free port; empty string clears it.
        SERVER__PORT: '0',
        // Disable the internal web/daemon server — the SDK communicates
        // via stdin/stdout, so the HTTP control server is unnecessary.
        CODEBUDDY_DISABLE_WEB: 'true',
      },
      stderr: (data) => {
        // Log CLI stderr for debugging
        const trimmed = data.trim();
        if (trimmed) {
          console.error('[CLI stderr]', trimmed);
        }
      },
    });

    await s.connect();
    console.log('[PPIC] Session connected. Session ID:', s.sessionId);
    session = s;
    return s;
  })();

  return sessionInitPromise;
}

// ─── Express Server ───────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend
const publicDir = path.join(PROJECT_ROOT, 'public');
app.use(express.static(publicDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PPIC Alter-S' });
});

// Serve demo data files (read-only, for transparency)
app.get('/api/demo-data', (req, res) => {
  try {
    const files = {};
    for (const f of ['orders.csv', 'bom.csv', 'inventory.csv']) {
      const fp = path.join(DATA_DIR, f);
      if (fs.existsSync(fp)) {
        files[f] = fs.readFileSync(fp, 'utf-8');
      }
    }
    res.json({ files, note: 'All data is SYNTHETIC DEMO DATA.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat endpoint with SSE streaming ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendSSE('status', { message: 'Connecting to PPIC Alter-S agent...' });

    const s = await getSession();

    sendSSE('status', { message: 'Agent is thinking...' });

    // Send the user's message to the session
    await s.send(message);

    let assistantText = '';

    // Stream messages from the agent
    for await (const msg of s.stream()) {
      // Partial streaming text (real-time token-by-token rendering)
      if (msg.type === 'stream_event') {
        const evt = msg.event;
        // content_block_delta for streaming text
        if (evt?.type === 'content_block_delta' && evt?.delta?.type === 'text_delta') {
          assistantText += evt.delta.text;
          sendSSE('text_delta', { text: evt.delta.text });
        }
        // tool_use start — notify frontend that a tool is being called
        if (evt?.type === 'content_block_start' && evt?.content_block?.type === 'tool_use') {
          sendSSE('tool_start', {
            id: evt.content_block.id,
            name: evt.content_block.name,
          });
        }
      }

      // Complete assistant message (contains tool_use blocks)
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use') {
            sendSSE('tool_use', {
              id: block.id,
              name: block.name,
              input: block.input,
            });
          }
        }
      }

      // User message — this is where tool_result content blocks appear
      // (the CLI sends tool results back as user messages with tool_result blocks)
      if (msg.type === 'user' && msg.parent_tool_use_id) {
        // This is a tool result for a sub-agent call; extract result
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              let resultContent = block.content;
              if (Array.isArray(resultContent)) {
                const textBlock = resultContent.find(c => c.type === 'text');
                if (textBlock) {
                  try {
                    resultContent = JSON.parse(textBlock.text);
                  } catch {
                    resultContent = textBlock.text;
                  }
                }
              } else if (typeof resultContent === 'string') {
                try {
                  resultContent = JSON.parse(resultContent);
                } catch {
                  // keep as string
                }
              }
              sendSSE('tool_result', {
                id: block.tool_use_id,
                result: resultContent,
                is_error: block.is_error || false,
              });
            }
          }
        }
        // Also check tool_use_result field (alternative location)
        if (msg.tool_use_result) {
          let resultContent = msg.tool_use_result;
          if (typeof resultContent === 'string') {
            try {
              resultContent = JSON.parse(resultContent);
            } catch {
              // keep as string
            }
          }
          sendSSE('tool_result', {
            id: msg.parent_tool_use_id,
            result: resultContent,
          });
        }
      }

      // Result message (turn complete)
      if (msg.type === 'result') {
        sendSSE('result', {
          duration_ms: msg.duration_ms,
          num_turns: msg.num_turns,
          is_error: msg.is_error,
        });
      }

      // Error message
      if (msg.type === 'error') {
        sendSSE('error', { error: msg.error });
      }
    }

    sendSSE('done', { message: 'complete' });
  } catch (err) {
    console.error('[PPIC] Chat error:', err);
    sendSSE('error', {
      error: err.message || 'An unexpected error occurred.',
    });
    sendSSE('done', { message: 'error' });
  } finally {
    res.end();
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n┌─────────────────────────────────────────────────────────┐`);
  console.log(`│  PPIC Alter-S — Production Planning & Inventory Intel   │`);
  console.log(`│  Agent Web Application (CodeBuddy Agent SDK)            │`);
  console.log(`└─────────────────────────────────────────────────────────┘`);
  console.log(`\n  Server:  http://localhost:${PORT}`);
  console.log(`  Data:    ${DATA_DIR}`);
  console.log(`  Script:  ${COMPUTE_SCRIPT}`);
  console.log(`\n  Try asking: "Can we produce 500 units of Product A for order MO-001?"\n`);

  // Pre-warm the session
  getSession().catch(err => {
    console.error('[PPIC] Failed to initialize session:', err.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[PPIC] SIGTERM received, shutting down...');
  if (session) session.close();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[PPIC] SIGINT received, shutting down...');
  if (session) session.close();
  process.exit(0);
});
