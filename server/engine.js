/**
 * PPIC Alter-S — deterministic planning engine (Node wrapper)
 *
 * Single source of truth for every number the application shows.
 * The arithmetic lives in compute_shortage.py and is invoked as a
 * subprocess, so the language model can never "calculate" a value.
 *
 *   required  = BOM qty_per_unit x production quantity
 *   available = max(on_hand - reserved, 0)
 *   shortage  = max(required - available, 0)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDbConfigured, dataSource, materializeDataset, fetchDataset, recordPlanRun } from './db.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DEMO_DATA_DIR
  ? path.resolve(process.env.DEMO_DATA_DIR)
  : path.join(PROJECT_ROOT, 'demo-data');

const COMPUTE_SCRIPT = path.join(__dirname, 'compute_shortage.py');

/**
 * Run the deterministic engine for one production order.
 *
 * @param {string} orderId
 * @returns {Promise<{ok: true, plan: object} | {ok: false, code: string, error: string}>}
 */
export async function computePlan(orderId) {
  const id = String(orderId ?? '').trim().toUpperCase();

  if (!id) {
    return { ok: false, code: 'EMPTY_ORDER_ID', error: 'No production order ID was provided.' };
  }

  // Supabase mode writes the rows to a temp CSV dir so the same tested Python
  // engine computes the plan for both sources.
  let dataDir = DATA_DIR;
  let cleanup = null;

  if (isDbConfigured()) {
    try {
      const dataset = await materializeDataset();
      dataDir = dataset.dir;
      cleanup = dataset.cleanup;
    } catch (err) {
      return { ok: false, code: 'DB_ERROR', error: err.message };
    }
  }

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [COMPUTE_SCRIPT, id, '--data-dir', dataDir, '--json', '--no-write'],
      { timeout: 15000, cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 }
    );

    const plan = JSON.parse(stdout);

    // Persist the draft PR + audit trail when a database is configured.
    // Never blocks the planner: failures are logged, not thrown.
    if (isDbConfigured()) {
      try {
        const recorded = await recordPlanRun(plan);
        if (!recorded.recorded) {
          console.warn('[engine] plan not persisted:', recorded.reason);
        }
      } catch (err) {
        console.warn('[engine] plan not persisted:', err.message);
      }
    }

    return { ok: true, plan };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        code: 'PYTHON_MISSING',
        error: 'The deterministic engine could not start: python3 was not found on PATH.',
      };
    }

    const stderr = String(err.stderr ?? '');

    if (stderr) {
      // The engine reports input/data problems on stderr as "ERROR: ...".
      // Anything before that line is interpreter noise (sitecustomize, env
      // warnings) and must not reach the planner.
      const marker = stderr.match(/^ERROR:\s*(.+)$/m);
      if (marker) {
        return { ok: false, code: 'PLAN_ERROR', error: describeSource(marker[1].trim()) };
      }

      const lastLine = stderr
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .pop();

      return {
        ok: false,
        code: 'ENGINE_FAILURE',
        error: lastLine || 'The deterministic engine failed without a message.',
      };
    }

    return {
      ok: false,
      code: 'ENGINE_FAILURE',
      error: `The deterministic engine failed: ${err.message}`,
    };
  } finally {
    cleanup?.();
  }
}

/** The engine says "orders.csv"; when data comes from Supabase that is wrong. */
function describeSource(message) {
  return isDbConfigured() ? message.replace(/orders\.csv/g, 'the database') : message;
}

function readCsv(file) {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) return [];
  const [headerLine, ...rows] = fs.readFileSync(full, 'utf-8').trim().split('\n');
  const headers = headerLine.split(',').map((h) => h.trim());
  return rows
    .filter((r) => r.trim())
    .map((row) => {
      const cells = row.split(',').map((c) => c.trim());
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    });
}

/** Read-only snapshot of the dataset for the UI sidebar. */
export async function demoData() {
  if (isDbConfigured()) {
    try {
      const { orders, bom, inventory } = await fetchDataset();
      return {
        orders,
        bom,
        inventory,
        source: 'supabase',
        note: 'All data is synthetic demo data, invented for this prototype.',
      };
    } catch (err) {
      // Fall through to the CSV snapshot rather than emptying the panel.
      console.warn('[engine] demo data from Supabase failed:', err.message);
    }
  }

  return {
    orders: readCsv('orders.csv'),
    bom: readCsv('bom.csv'),
    inventory: readCsv('inventory.csv'),
    source: 'csv',
    note: 'All data is synthetic demo data, invented for this prototype.',
  };
}

/** Known order IDs, used to give an honest, helpful error. */
export async function knownOrderIds() {
  if (isDbConfigured()) {
    try {
      const { orders } = await fetchDataset();
      return orders.map((r) => r.order_id).filter(Boolean);
    } catch (err) {
      console.warn('[engine] order list from Supabase failed:', err.message);
    }
  }

  return readCsv('orders.csv')
    .map((r) => r.order_id)
    .filter(Boolean);
}

export { dataSource };
