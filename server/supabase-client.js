/**
 * PPIC Alter-S — Supabase Database Client
 *
 * Provides database access for the PPIC Alter-S backend.
 * When SUPABASE_URL and SUPABASE_SERVICE_KEY are set, all reads/writes
 * go to Supabase Postgres. When they are NOT set, the backend falls
 * back to reading CSV files from demo-data/ (the original mode).
 *
 * Tables (see db/migrations/001_initial_schema.sql):
 *   products, materials, bom, production_orders, inventory,
 *   purchase_requests, purchase_request_lines, audit_log
 *
 * View:
 *   v_material_plan — deterministic required/available/shortage per order+material
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

/**
 * Returns true if Supabase is configured (URL + key present).
 */
export function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

/**
 * Get the Supabase client (singleton). Throws if not configured.
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/**
 * Compute the material plan for an order using the Supabase view.
 *
 * Mirrors the deterministic logic in backend/compute_shortage.py:
 *   required  = BOM qty_per_unit x order quantity
 *   available = max(on_hand - reserved, 0)
 *   shortage  = max(required - available, 0)
 *
 * @param {string} orderId — e.g. "MO-001"
 * @returns {Promise<{order, lines, pr_draft}>}
 */
export async function computePlanFromDB(orderId) {
  const sb = getSupabase();

  // 1. Fetch the order
  const { data: orderRow, error: orderErr } = await sb
    .from('production_orders')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (orderErr || !orderRow) {
    throw new Error(`order '${orderId}' not found in database. No data fabricated.`);
  }

  if (orderRow.quantity <= 0) {
    throw new Error(`order ${orderId} has non-positive quantity (${orderRow.quantity}).`);
  }

  // 2. Fetch material plan from the view (deterministic, computed in Postgres)
  const { data: planRows, error: planErr } = await sb
    .from('v_material_plan')
    .select('*')
    .eq('order_id', orderId)
    .order('material_id');

  if (planErr) {
    throw new Error(`database error fetching material plan: ${planErr.message}`);
  }

  if (!planRows || planRows.length === 0) {
    // Check if BOM exists
    const { data: bomRows } = await sb
      .from('bom')
      .select('*')
      .eq('product_id', orderRow.product_id);

    if (!bomRows || bomRows.length === 0) {
      throw new Error(`no BOM found for product '${orderRow.product_id}' (order ${orderId}).`);
    }

    // BOM exists but inventory rows missing
    throw new Error(`missing inventory rows for order ${orderId}. Cannot compute availability.`);
  }

  // 3. Build the response (same shape as compute_shortage.py output)
  const lines = planRows.map(row => ({
    material_id: row.material_id,
    material_name: row.material_name,
    unit: row.unit,
    qty_per_unit: row.qty_per_unit,
    required: row.required,
    on_hand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    shortage: row.shortage,
  }));

  // 4. Build PR draft for shortage lines only
  const shortageLines = lines.filter(l => l.shortage > 0);

  const pr_draft = shortageLines.length > 0
    ? {
        pr_id: `PR-${orderId}`,
        order_id: orderId,
        product_id: orderRow.product_id,
        product_name: orderRow.product_name,
        status: 'PENDING_HUMAN_APPROVAL',
        note: 'DRAFT ONLY — no purchase has been made. A human must review and approve before any PO is created.',
        lines: shortageLines.map(l => ({
          material_id: l.material_id,
          material_name: l.material_name,
          unit: l.unit,
          quantity: l.shortage,
        })),
      }
    : {
        pr_id: null,
        order_id: orderId,
        product_id: orderRow.product_id,
        product_name: orderRow.product_name,
        status: 'NO_PURCHASE_NEEDED',
        note: 'No material shortage for this order — no purchase request needed.',
        lines: [],
      };

  // 5. Write audit log
  await sb.from('audit_log').insert({
    action: 'COMPUTE_PLAN',
    entity_type: 'production_order',
    entity_id: orderId,
    actor: 'system',
    details: {
      shortage_count: shortageLines.length,
      shortage_materials: shortageLines.map(l => l.material_id),
      synthetic: true,
    },
  });

  return { order: orderRow, lines, pr_draft };
}

/**
 * Save a purchase request draft to the database.
 * Does NOT execute any purchase — only stores the draft.
 */
export async function saveDraftPR(prDraft) {
  if (!prDraft.pr_id || prDraft.status === 'NO_PURCHASE_NEEDED') {
    return null;
  }

  const sb = getSupabase();

  // Upsert the PR header
  const { error: prErr } = await sb
    .from('purchase_requests')
    .upsert({
      pr_id: prDraft.pr_id,
      order_id: prDraft.order_id,
      product_id: prDraft.product_id,
      product_name: prDraft.product_name,
      status: prDraft.status,
      note: prDraft.note,
    });

  if (prErr) throw new Error(`failed to save PR: ${prErr.message}`);

  // Insert lines (delete existing first to avoid duplicates)
  await sb
    .from('purchase_request_lines')
    .delete()
    .eq('pr_id', prDraft.pr_id);

  if (prDraft.lines.length > 0) {
    const lines = prDraft.lines.map(l => ({
      pr_id: prDraft.pr_id,
      material_id: l.material_id,
      material_name: l.material_name,
      unit: l.unit,
      quantity: l.quantity,
    }));

    const { error: linesErr } = await sb
      .from('purchase_request_lines')
      .insert(lines);

    if (linesErr) throw new Error(`failed to save PR lines: ${linesErr.message}`);
  }

  // Audit log
  await sb.from('audit_log').insert({
    action: 'CREATE_PR_DRAFT',
    entity_type: 'purchase_request',
    entity_id: prDraft.pr_id,
    actor: 'system',
    details: {
      line_count: prDraft.lines.length,
      status: prDraft.status,
      synthetic: true,
    },
  });

  return prDraft;
}

/**
 * Get all demo data from Supabase (for the /api/demo-data endpoint).
 */
export async function getDemoDataFromDB() {
  const sb = getSupabase();

  const [orders, bom, inventory] = await Promise.all([
    sb.from('production_orders').select('*').order('order_id'),
    sb.from('bom').select('*').order('product_id, material_id'),
    sb.from('inventory').select('*').order('material_id'),
  ]);

  return {
    orders: orders.data || [],
    bom: bom.data || [],
    inventory: inventory.data || [],
    note: 'All data is SYNTHETIC DEMO DATA.',
  };
}
