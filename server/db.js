/**
 * PPIC Alter-S — data access layer
 *
 * Two interchangeable sources, one shape:
 *
 *   supabase — production_orders / bom / materials / inventory tables
 *              (see db/migrations/001_initial_schema.sql)
 *   csv      — demo-data/*.csv, used when SUPABASE_URL is not configured
 *
 * The deterministic arithmetic never lives here: this module only fetches
 * rows and materialises them in the CSV layout compute_shortage.py reads,
 * so both sources go through the exact same tested engine.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let client = null;

/** True when both a project URL and a key are configured. */
export function isDbConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** 'supabase' | 'csv' — surfaced in /api/health so the mode is never guessed. */
export function dataSource() {
  return isDbConfigured() ? 'supabase' : 'csv';
}

function getClient() {
  if (!isDbConfigured()) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function fail(context, error) {
  const detail =
    typeof error === 'string'
      ? error
      : [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' — ') ||
        JSON.stringify(error);
  throw new Error(`${context}: ${detail || 'unknown database error'}`);
}

/** Fetch the three datasets the engine needs, in CSV column shape. */
export async function fetchDataset() {
  const db = getClient();

  const [orders, bom, inventory] = await Promise.all([
    db
      .from('production_orders')
      .select('order_id,product_id,product_name,quantity,unit,due_date,status')
      .order('order_id'),
    db
      .from('bom')
      .select('product_id,material_id,qty_per_unit,unit,materials(material_name)')
      .order('product_id'),
    db.from('inventory').select('material_id,material_name,unit,on_hand,reserved').order('material_id'),
  ]);

  if (orders.error) fail('Could not read production_orders', orders.error);
  if (bom.error) fail('Could not read bom', bom.error);
  if (inventory.error) fail('Could not read inventory', inventory.error);

  return {
    orders: orders.data ?? [],
    // PostgREST embeds the joined material as a nested object (or array).
    bom: (bom.data ?? []).map((row) => ({
      product_id: row.product_id,
      material_id: row.material_id,
      material_name: row.materials?.material_name ?? row.materials?.[0]?.material_name ?? '',
      unit: row.unit,
      qty_per_unit: row.qty_per_unit,
    })),
    inventory: inventory.data ?? [],
  };
}

// ─── CSV materialisation ─────────────────────────────────────────────────────

function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return `${lines.join('\n')}\n`;
}

/**
 * Write the Supabase rows to a throwaway CSV directory in the layout
 * compute_shortage.py expects.
 *
 * @returns {Promise<{dir: string, cleanup: () => void}>}
 */
export async function materializeDataset() {
  const { orders, bom, inventory } = await fetchDataset();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppic-dataset-'));
  fs.writeFileSync(
    path.join(dir, 'orders.csv'),
    toCsv(['order_id', 'product_id', 'product_name', 'quantity', 'unit', 'due_date', 'status'], orders)
  );
  fs.writeFileSync(
    path.join(dir, 'bom.csv'),
    toCsv(['product_id', 'material_id', 'material_name', 'unit', 'qty_per_unit'], bom)
  );
  fs.writeFileSync(
    path.join(dir, 'inventory.csv'),
    toCsv(['material_id', 'material_name', 'unit', 'on_hand', 'reserved'], inventory)
  );

  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}

// ─── Purchase request persistence ────────────────────────────────────────────

/**
 * Persist the draft PR for a computed plan and write an audit entry.
 *
 * Never approves anything: status stays PENDING_HUMAN_APPROVAL. Failures are
 * non-fatal — the planner still gets the plan, and the caller logs the reason.
 *
 * @param {object} plan — the JSON produced by compute_shortage.py
 */
export async function recordPlanRun(plan) {
  if (!isDbConfigured()) return { recorded: false, reason: 'csv mode' };

  const db = getClient();
  const order = plan?.order;
  const pr = plan?.pr_draft;
  if (!order?.order_id) return { recorded: false, reason: 'plan has no order' };

  const shortLines = (plan.lines ?? []).filter((l) => Number(l.shortage) > 0);

  let prWritten = false;

  if (pr?.pr_id && shortLines.length > 0) {
    const { error: prError } = await db.from('purchase_requests').upsert(
      {
        pr_id: pr.pr_id,
        order_id: order.order_id,
        product_id: order.product_id,
        product_name: order.product_name,
        status: pr.status ?? 'PENDING_HUMAN_APPROVAL',
        note: 'Draft generated by PPIC Alter-S. Human approval required before any purchase.',
      },
      { onConflict: 'pr_id' }
    );

    if (prError) return { recorded: false, reason: `purchase_requests: ${prError.message}` };

    // Lines are replaced so repeated runs do not accumulate duplicates.
    const { error: deleteError } = await db
      .from('purchase_request_lines')
      .delete()
      .eq('pr_id', pr.pr_id);
    if (deleteError) return { recorded: false, reason: `purchase_request_lines delete: ${deleteError.message}` };

    const { error: linesError } = await db.from('purchase_request_lines').insert(
      shortLines.map((line) => ({
        pr_id: pr.pr_id,
        material_id: line.material_id,
        material_name: line.material_name,
        unit: line.unit,
        quantity: line.shortage,
      }))
    );
    if (linesError) return { recorded: false, reason: `purchase_request_lines: ${linesError.message}` };

    prWritten = true;
  }

  const { error: auditError } = await db.from('audit_log').insert({
    action: 'PLAN_COMPUTED',
    entity_type: 'production_order',
    entity_id: order.order_id,
    actor: 'agent',
    details: {
      quantity: order.quantity,
      unit: order.unit,
      short_lines: shortLines.length,
      pr_id: prWritten ? pr.pr_id : null,
      pr_status: prWritten ? (pr.status ?? 'PENDING_HUMAN_APPROVAL') : null,
      source: 'supabase',
    },
  });

  if (auditError) return { recorded: false, reason: `audit_log: ${auditError.message}` };

  return { recorded: true, prWritten };
}
