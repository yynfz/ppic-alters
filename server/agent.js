/**
 * PPIC Alter-S — agent layer
 *
 * Two execution paths, one contract:
 *
 *   1. `sdk`     — a CodeBuddy Agent SDK session. The model reads the planner's
 *                  question, calls the `compute_material_plan` MCP tool, and
 *                  narrates the result. The model never does arithmetic.
 *
 *   2. `offline` — used when no CodeBuddy model credential is available. A
 *                  deterministic orchestrator resolves the order reference and
 *                  runs the exact same tool, so the numbers and guardrails are
 *                  identical. The UI labels this mode explicitly.
 *
 * In both paths every figure comes from engine.js -> compute_shortage.py.
 */

import { unstable_v2_createSession, createSdkMcpServer, tool } from '@tencent-ai/agent-sdk';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { computePlan, knownOrderIds, PROJECT_ROOT } from './engine.js';

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are **PPIC Alter-S**, an agentic production planning and inventory intelligence assistant for a manufacturing planner.

## What you do
A planner asks things like "Can we produce 500 units of Product A for order MO-001?". You answer by calling the \`compute_material_plan\` tool, which runs a deterministic engine over the production order, bill of materials, and inventory ledger.

## Non-negotiable rules
1. **Call the tool before you state any number.** You have no other source of BOM, stock, or order data. If you have not called the tool, you do not know the answer.
2. **Never invent, estimate, or "round" BOM or stock figures.** Every quantity you mention must appear in a tool result.
3. **Never compute arithmetic yourself.** required, available, and shortage are produced by the tool.
4. **Never claim a purchase was made, a PO was created, or an order was placed.** You only prepare a DRAFT purchase request with status PENDING_HUMAN_APPROVAL. A human must approve it.
5. **If the tool returns an error**, relay it honestly and stop. Do not guess at data, do not substitute a similar order, do not fabricate a plan. If the order is unknown, say so and list the orders that do exist if the tool provides them.
6. **All data is synthetic demo data.** Say so when the planner asks about data provenance.

## Response style
- **Always write in English**, regardless of the language of the demo data, tool output, or the planner's message.
- Write 2-4 short sentences. The interface renders the material plan table and the purchase request card itself, so **do not print tables, ASCII grids, or JSON**.
- Lead with the verdict: can the order be produced from current stock, and what is short.
- Use **bold** for the order ID, material names, and the PR ID.
- When a draft PR exists, state that it is a draft awaiting human approval and that nothing has been ordered.
- If nothing is short, say the order is fully covered and that no purchase request is needed.
- Quantities keep their units (kg, pcs). Never merge different units into one total.

## Conversation
Multi-turn. Each question about an order must trigger a fresh tool call. If the planner does not name an order, ask which one they mean.`;

// ─── MCP tool ────────────────────────────────────────────────────────────────

const computeTool = tool(
  'compute_material_plan',
  `Compute the deterministic material plan for one production order.

Reads the production order, its bill of materials, and the inventory ledger, then applies fixed rules:

  required  = BOM qty_per_unit x production quantity
  available = max(on_hand - reserved, 0)
  shortage  = max(required - available, 0)

Returns per-material lines plus, when anything is short, a draft purchase request with status PENDING_HUMAN_APPROVAL. It never creates a purchase order and never invents data: an unknown order returns an explicit error listing the orders that do exist.

All values are synthetic demo data.`,
  {
    order_id: z.string().describe('Production order ID, for example "MO-001"'),
  },
  async ({ order_id }) => {
    const result = await computePlan(order_id);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `ERROR: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.plan, null, 2) }],
    };
  }
);

const mcpServer = createSdkMcpServer({
  name: 'ppic-alters',
  version: '1.0.0',
  tools: [computeTool],
});

// ─── Session state ───────────────────────────────────────────────────────────

const state = {
  mode: 'unknown', // 'unknown' | 'sdk' | 'offline'
  reason: null,
  verified: false, // true once an SDK turn has actually completed
  session: null,
};

let connecting = null;

export function agentStatus() {
  return { mode: state.mode, reason: state.reason, verified: state.verified };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * The SDK needs an explicit credential for server-side use.
 *
 * A desktop `codebuddy` login also works, but it is machine-specific, so it
 * must be opted into with PPIC_FORCE_SDK=1 rather than guessed at.
 */
function hasCredential() {
  return Boolean(
    process.env.CODEBUDDY_API_KEY ||
      process.env.CODEBUDDY_AUTH_TOKEN ||
      process.env.PPIC_FORCE_SDK === '1'
  );
}

/**
 * Connect the CodeBuddy Agent SDK session. Falls back to deterministic mode
 * when no credential is available, instead of surfacing a raw CLI error.
 */
export async function ensureAgent() {
  if (state.mode === 'sdk' && state.session) return { mode: 'sdk', session: state.session };
  if (state.mode === 'offline') return { mode: 'offline', reason: state.reason };
  if (connecting) return connecting;

  if (!hasCredential()) {
    state.mode = 'offline';
    state.reason =
      'No CodeBuddy model credential is configured, so the deterministic orchestrator is answering. Set CODEBUDDY_API_KEY to enable the language model.';
    return { mode: 'offline', reason: state.reason };
  }

  connecting = (async () => {
    const env = {
      // Keep the host's own configuration dir so an existing `codebuddy`
      // login is reused. Set PPIC_SDK_CONFIG_DIR only to isolate the CLI.
      ...(process.env.PPIC_SDK_CONFIG_DIR
        ? { CODEBUDDY_CONFIG_DIR: path.resolve(process.env.PPIC_SDK_CONFIG_DIR) }
        : {}),
      // The desktop host exports SERVER__PORT for its own control server. If
      // the child CLI inherits it, it fails with EADDRINUSE and the session
      // yields nothing. 0 makes the OS pick a free port.
      SERVER__PORT: '0',
      CODEBUDDY_CODE_DISABLE_AUTO_MEMORY: '1',
      DISABLE_TELEMETRY: '1',
    };

    if (process.env.PPIC_SDK_CONFIG_DIR) {
      fs.mkdirSync(process.env.PPIC_SDK_CONFIG_DIR, { recursive: true });
    }

    let session = null;

    try {
      session = unstable_v2_createSession({
        model: process.env.PPIC_MODEL || undefined,
        cwd: PROJECT_ROOT,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: 'default',
        maxTurns: 12,
        includePartialMessages: true,
        mcpServers: { 'ppic-alters': mcpServer },
        // Read-only agent: it may only call the deterministic tool.
        allowedTools: ['mcp__ppic-alters__compute_material_plan'],
        disallowedTools: ['Bash', 'Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch'],
        env,
        stderr: (data) => {
          const line = String(data).trim();
          if (line) console.error('[agent-cli]', line);
        },
      });

      await withTimeout(session.connect(), 30000, 'Agent SDK connect');

      state.mode = 'sdk';
      state.reason = null;
      state.session = session;
      console.log('[PPIC] Agent SDK session connected:', session.sessionId);
      return { mode: 'sdk', session };
    } catch (err) {
      try {
        session?.close?.();
      } catch {
        /* ignore */
      }

      const message = String(err?.message ?? err);
      const authProblem = /auth|login|credential|unauthori[sz]ed|401|api.?key/i.test(message);

      state.mode = 'offline';
      state.reason = authProblem
        ? 'No CodeBuddy model credential available — running the deterministic orchestrator.'
        : `Agent SDK unavailable (${message.slice(0, 160)}) — running the deterministic orchestrator.`;

      console.warn('[PPIC]', state.reason);
      return { mode: 'offline', reason: state.reason };
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('en-US');

function fmt(value) {
  return typeof value === 'number' ? nf.format(value) : String(value ?? '');
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function orderRef(text) {
  const match = String(text).match(/\bMO[-\s]?(\d{1,5})\b/i);
  return match ? `MO-${match[1].padStart(3, '0')}` : null;
}

/** Extract a plan object from a tool_result content payload. */
function parsePlanPayload(payload) {
  if (!payload) return null;
  let text = payload;

  if (Array.isArray(payload)) {
    const block = payload.find((c) => c?.type === 'text');
    if (!block) return null;
    text = block.text;
  }

  if (typeof text === 'string') {
    try {
      const parsed = JSON.parse(text);
      return parsed && parsed.order && Array.isArray(parsed.lines) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof text === 'object' && text.order && Array.isArray(text.lines)) return text;
  return null;
}

// ─── Deterministic orchestrator (offline mode) ───────────────────────────────

function isGreeting(text) {
  return /^(hi|hello|hey|halo|hai|good (morning|afternoon|evening))\b[\s!.?]*$/i.test(text.trim());
}

function buildNarrative(plan, message) {
  const { order, lines, pr_draft: pr } = plan;
  const shortLines = lines.filter((l) => l.shortage > 0);
  const covered = lines.length - shortLines.length;
  const due = formatDate(order.due_date);
  const wantsShortage = /short|shortage|lack|missing|kurang/i.test(message);

  const head = `**${order.order_id}** · ${order.product_name} · **${fmt(order.quantity)} ${order.unit}**${
    due ? ` · due ${due}` : ''
  }`;

  if (shortLines.length === 0) {
    return `${head}

All ${lines.length} materials are covered by available stock (on hand minus reserved). This order can be produced without purchasing anything, so no purchase request was created.`;
  }

  const names = shortLines.map((l) => `**${l.material_name}**`).join(' and ');

  if (wantsShortage) {
    return `${head}

${shortLines.length} of ${lines.length} materials are short: ${names}. ${covered} ${
      covered === 1 ? 'material is' : 'materials are'
    } covered by available stock. Draft purchase request **${pr?.pr_id}** is ready for your review — nothing has been ordered.`;
  }

  return `${head}

This order cannot be produced from current stock: ${shortLines.length} of ${lines.length} materials are short (${names}). I prepared draft purchase request **${
    pr?.pr_id
  }** for human review. Nothing has been ordered.`;
}

async function* runOffline(message) {
  if (isGreeting(message)) {
    const ids = knownOrderIds();
    yield {
      type: 'text',
      text: `Hello. I can check whether a production order can be built from current stock, show which materials are short, and prepare a purchase request draft for you to review.\n\nAsk me about an order — ${ids
        .map((id) => `**${id}**`)
        .join(' or ')} in the demo dataset — for example: *Can we produce 500 units of Product A for order MO-001?*`,
    };
    return;
  }

  const orderId = orderRef(message);

  if (!orderId) {
    const ids = knownOrderIds();
    yield {
      type: 'text',
      text: `Which production order should I check? I do not want to guess at an order ID.\n\nAvailable in the demo dataset: ${ids
        .map((id) => `**${id}**`)
        .join(', ')}.`,
    };
    return;
  }

  yield { type: 'status', message: `Reading order ${orderId}…` };

  const toolId = `offline-${Date.now()}`;
  yield { type: 'tool_start', id: toolId, name: 'compute_material_plan', input: { order_id: orderId } };

  const result = await computePlan(orderId);

  if (!result.ok) {
    yield {
      type: 'tool_result',
      id: toolId,
      ok: false,
      error: result.error,
    };
    yield {
      type: 'text',
      text: `I could not build a plan for **${orderId}**.\n\n${result.error}\n\nI will not guess at the missing data — tell me which order to check, or add it to the demo dataset.`,
    };
    return;
  }

  yield { type: 'tool_result', id: toolId, ok: true, plan: result.plan };
  yield { type: 'plan', plan: result.plan };
  yield { type: 'text', text: buildNarrative(result.plan, message) };
}

// ─── SDK path ────────────────────────────────────────────────────────────────

const AUTH_FAILURE =
  /authentication required|please use \/login|unauthori[sz]ed|invalid api key|not logged in/i;

function authError(message) {
  const err = new Error(message || 'Authentication required');
  err.code = 'AUTH_REQUIRED';
  return err;
}

/**
 * Run one turn through the Agent SDK.
 *
 * Text is buffered until it passes a small threshold, so that a rejected
 * credential (which the CLI reports as an ordinary assistant message) can be
 * detected before anything is shown to the planner.
 */
async function* runSdk(session, message) {
  await session.send(message);

  const GUARD = 140;
  let pending = '';
  let released = false;
  let sawDelta = false;

  for await (const msg of session.stream()) {
    if (msg.type === 'stream_event') {
      const evt = msg.event;

      if (evt?.type === 'content_block_delta' && evt?.delta?.type === 'text_delta') {
        const delta = evt.delta.text ?? '';
        sawDelta = true;

        if (released) {
          yield { type: 'text_delta', text: delta };
        } else {
          pending += delta;
          if (AUTH_FAILURE.test(pending)) throw authError(pending);
          if (pending.length >= GUARD) {
            released = true;
            const text = pending;
            pending = '';
            yield { type: 'text_delta', text };
          }
        }
      }

      if (evt?.type === 'content_block_start' && evt?.content_block?.type === 'tool_use') {
        yield {
          type: 'tool_start',
          id: evt.content_block.id,
          name: evt.content_block.name,
        };
      }
      continue;
    }

    if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_use') {
          yield { type: 'tool_start', id: block.id, name: block.name, input: block.input };
        }
        // Only used when the CLI does not stream partial deltas.
        if (block.type === 'text' && !sawDelta && block.text?.trim()) {
          if (AUTH_FAILURE.test(block.text)) throw authError(block.text);
          pending += block.text;
        }
      }
      continue;
    }

    if (msg.type === 'user') {
      for (const block of msg.message?.content ?? []) {
        if (block.type !== 'tool_result') continue;

        const plan = parsePlanPayload(block.content);

        if (block.is_error) {
          const raw = Array.isArray(block.content)
            ? block.content.find((c) => c?.type === 'text')?.text
            : String(block.content ?? '');
          yield {
            type: 'tool_result',
            id: block.tool_use_id,
            ok: false,
            error: String(raw ?? '').replace(/^ERROR:\s*/, ''),
          };
        } else {
          yield { type: 'tool_result', id: block.tool_use_id, ok: true, plan };
          if (plan) yield { type: 'plan', plan };
        }
      }
      continue;
    }

    if (msg.type === 'error') {
      throw new Error(msg.error || 'The agent transport reported an error.');
    }

    if (msg.type === 'result' && msg.is_error) {
      const detail = Array.isArray(msg.errors) ? msg.errors.join(' ') : '';
      if (AUTH_FAILURE.test(detail)) throw authError(detail);
      throw new Error(detail || 'The agent stopped before completing the request.');
    }
  }

  if (!released && pending) {
    if (AUTH_FAILURE.test(pending)) throw authError(pending);
    yield { type: 'text_delta', text: pending };
  }
}

// ─── Public turn runner ──────────────────────────────────────────────────────

/**
 * Run one conversational turn, yielding UI events.
 * @param {string} message
 */
export async function* runTurn(message) {
  const agent = await ensureAgent();

  if (agent.mode === 'sdk') {
    try {
      yield* runSdk(agent.session, message);
      state.verified = true;
      return;
    } catch (err) {
      const rejectedCredential =
        err?.code === 'AUTH_REQUIRED' || AUTH_FAILURE.test(String(err?.message ?? ''));

      try {
        state.session?.close?.();
      } catch {
        /* ignore */
      }
      state.session = null;
      state.verified = false;

      if (rejectedCredential) {
        state.mode = 'offline';
        state.reason =
          'The configured CodeBuddy credential was rejected, so the deterministic orchestrator answered. Check CODEBUDDY_API_KEY.';
        console.warn('[PPIC] Model credential rejected; using deterministic mode.');
      } else {
        state.mode = 'unknown';
        console.error('[PPIC] SDK turn failed:', err?.message ?? err);
        yield { type: 'status', message: 'Agent session dropped — retrying…' };
      }
    }
  }

  yield* runOffline(message);
}
