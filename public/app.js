/**
 * PPIC Alter-S — chat client
 *
 * Renders streamed agent events. Every number shown here comes from the
 * server's deterministic engine; the client never computes a quantity.
 */

(() => {
  'use strict';

  // ─── Elements ───────────────────────────────────────────────────────────
  const messagesEl = document.getElementById('messages');
  const formEl = document.getElementById('composer');
  const inputEl = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const modeBadge = document.getElementById('modeBadge');
  const modeText = document.getElementById('modeText');
  const panelEl = document.getElementById('panel');
  const panelBody = document.getElementById('panelBody');
  const panelToggle = document.getElementById('panelToggle');
  const panelClose = document.getElementById('panelClose');
  const scrim = document.getElementById('scrim');

  const nf = new Intl.NumberFormat('en-US');
  const fmt = (n) => (typeof n === 'number' ? nf.format(n) : String(n ?? ''));

  let busy = false;
  let healthTimer = null;
  let modeReason = null;
  let modeNoticeShown = false;

  // ─── Icons ──────────────────────────────────────────────────────────────
  const ICON = {
    spinner:
      '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke-linejoin="round"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-linecap="round"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-linecap="round"/></svg>',
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Minimal, safe markdown: paragraphs, bold, italics, inline code, lists. */
  function md(source) {
    let s = esc(source).trim();
    if (!s) return '';

    s = s.replace(/```[a-z]*\n?([\s\S]*?)```/gi, (_, code) => `<pre>${code.trim()}</pre>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
    s = s.replace(/(?:^|\n)((?:[-*] [^\n]*(?:\n|$))+)/g, (_, block) => {
      const items = block
        .trim()
        .split('\n')
        .map((line) => `<li>${line.replace(/^[-*]\s+/, '')}</li>`)
        .join('');
      return `\n<ul>${items}</ul>`;
    });

    return s
      .split(/\n{2,}/)
      .map((para) => {
        const p = para.trim();
        if (!p) return '';
        if (/^<(pre|ul|ol|blockquote)/.test(p)) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
  }

  function scrollDown(force = false) {
    const nearBottom =
      messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 160;
    if (force || nearBottom) {
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  }

  // ─── Mode badge ─────────────────────────────────────────────────────────
  function setMode(mode, reason, verified) {
    if (reason) modeReason = reason;

    const labels = {
      sdk: verified ? 'Agent ready' : 'Agent connected',
      offline: 'Deterministic mode',
      checking: 'Checking agent…',
    };
    modeBadge.dataset.mode = mode || 'checking';
    modeText.textContent = labels[mode] || labels.checking;
    modeBadge.title =
      mode === 'offline'
        ? modeReason || 'No model credential — the deterministic orchestrator is answering.'
        : mode === 'sdk'
          ? verified
            ? 'A CodeBuddy Agent SDK turn completed successfully.'
            : 'Connected to a CodeBuddy Agent SDK session.'
          : 'Connecting to the agent…';
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      const mode = data?.agent?.mode;

      if (mode === 'sdk' || mode === 'offline') {
        setMode(mode, data.agent.reason, data.agent.verified);
        if (healthTimer) clearInterval(healthTimer);
        healthTimer = null;
        return;
      }
      setMode('checking');
    } catch {
      setMode('checking');
    }
  }

  // ─── Message scaffolding ────────────────────────────────────────────────
  function addUserMessage(text) {
    const article = document.createElement('article');
    article.className = 'msg msg-user';
    article.innerHTML = `<div class="msg-body"><div class="bubble">${esc(text)}</div></div>`;
    messagesEl.appendChild(article);
    scrollDown(true);
  }

  function startAssistantMessage() {
    const article = document.createElement('article');
    article.className = 'msg msg-assistant';
    article.innerHTML = `
      <div class="avatar" aria-hidden="true">AS</div>
      <div class="msg-body">
        <div class="msg-text">
          <div class="typing-row">
            <div class="typing"><span></span><span></span><span></span></div>
            <span class="typing-label">Working through the order…</span>
          </div>
        </div>
        <div class="msg-cards"></div>
      </div>`;
    messagesEl.appendChild(article);
    scrollDown(true);

    const textEl = article.querySelector('.msg-text');
    const cardsEl = article.querySelector('.msg-cards');
    const bodyEl = article.querySelector('.msg-body');

    const ctx = {
      buffer: '',
      typing: textEl.querySelector('.typing-row'),
      traces: new Map(),

      clearTyping() {
        if (ctx.typing) {
          ctx.typing.remove();
          ctx.typing = null;
        }
      },

      setStatus(text) {
        const label = ctx.typing?.querySelector('.typing-label');
        if (label && text) label.textContent = text;
      },

      appendText(chunk) {
        ctx.clearTyping();
        ctx.buffer += chunk;
        textEl.innerHTML = md(ctx.buffer);
        scrollDown();
      },

      addTrace(id, name, input) {
        ctx.clearTyping();
        const arg = input?.order_id ? `(${input.order_id})` : '';
        const el = document.createElement('div');
        el.className = 'trace';
        el.dataset.state = 'running';
        el.dataset.name = name || 'compute_material_plan';
        el.dataset.arg = arg;
        el.innerHTML = `${ICON.spinner}<span class="trace-name">${esc(el.dataset.name)}</span><span>${esc(arg)}</span><span class="trace-status">running…</span>`;
        cardsEl.appendChild(el);
        ctx.traces.set(id, el);
        scrollDown();
      },

      updateTrace(id, ok, error) {
        const el = ctx.traces.get(id);
        if (!el) return;
        const { name, arg } = el.dataset;
        el.dataset.state = ok ? 'ok' : 'error';
        el.innerHTML = ok
          ? `${ICON.check}<span class="trace-name">${esc(name)}</span><span>${esc(arg)}</span><span class="trace-status">verified</span>`
          : `${ICON.alert}<span class="trace-name">${esc(name)}</span><span class="trace-status">${esc(
              error || 'failed'
            )}</span>`;
        scrollDown();
      },

      showPlan(plan) {
        ctx.clearTyping();
        const pr = plan.pr_draft;
        // A fully covered order returns a pr_draft shell with no lines and
        // status NO_PURCHASE_NEEDED. Never render that as a purchase request.
        const hasDraft = Boolean(pr && Array.isArray(pr.lines) && pr.lines.length > 0);
        const wrap = document.createElement('div');
        wrap.innerHTML = planCard(plan) + (hasDraft ? prCard(pr) : '');
        while (wrap.firstChild) cardsEl.appendChild(wrap.firstChild);
        scrollDown();
      },

      showError(message) {
        ctx.clearTyping();
        const el = document.createElement('div');
        el.className = 'notice notice-error';
        el.innerHTML = `${ICON.alert}<div>${esc(message)}</div>`;
        cardsEl.appendChild(el);
        scrollDown();
      },

      showNotice(html) {
        const el = document.createElement('div');
        el.className = 'notice notice-info';
        el.innerHTML = `${ICON.info}<div>${html}</div>`;
        bodyEl.prepend(el);
      },

      finish() {
        ctx.clearTyping();
        // Final render so streamed markdown is always fully applied.
        if (ctx.buffer) textEl.innerHTML = md(ctx.buffer);
        if (!ctx.buffer && !cardsEl.children.length) {
          textEl.innerHTML = '<p class="num-muted">No response was produced.</p>';
        }
      },
    };

    return ctx;
  }

  // ─── Plan card ──────────────────────────────────────────────────────────
  function planCard(plan) {
    const { order, lines } = plan;
    const shortCount = lines.filter((l) => l.shortage > 0).length;
    const pill =
      shortCount > 0
        ? `<span class="pill pill-warn">${shortCount} of ${lines.length} short</span>`
        : `<span class="pill pill-ok">Fully covered</span>`;

    const due = order.due_date
      ? new Date(`${order.due_date}T00:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

    const meta = [
      `${fmt(order.quantity)} ${esc(order.unit)}`,
      due ? `due ${esc(due)}` : null,
      esc(order.status),
    ]
      .filter(Boolean)
      .join(' · ');

    const rows = lines
      .map((line) => {
        const hit = line.shortage > 0;
        return `<tr>
          <td>
            <span class="mat-name">${esc(line.material_name)}</span>
            <span class="mat-id">${esc(line.material_id)}</span>
          </td>
          <td class="num-muted">${fmt(line.qty_per_unit)}<span class="unit">${esc(line.unit)}</span></td>
          <td class="num-strong">${fmt(line.required)}<span class="unit">${esc(line.unit)}</span></td>
          <td>${fmt(line.on_hand)}</td>
          <td class="num-muted">${fmt(line.reserved)}</td>
          <td>${fmt(line.available)}</td>
          <td class="${hit ? 'shortage-hit' : 'shortage-none'}">${hit ? fmt(line.shortage) : '—'}</td>
        </tr>`;
      })
      .join('');

    const calc = lines
      .map(
        (line) => `<li>
          <span class="calc-id">${esc(line.material_id)} ${esc(line.material_name)}</span><br>
          required&nbsp;&nbsp;= ${fmt(line.qty_per_unit)} ${esc(line.unit)}/unit × ${fmt(order.quantity)} = ${fmt(line.required)} ${esc(line.unit)}<br>
          available&nbsp;= max(${fmt(line.on_hand)} − ${fmt(line.reserved)}, 0) = ${fmt(line.available)} ${esc(line.unit)}<br>
          shortage&nbsp;&nbsp;= max(${fmt(line.required)} − ${fmt(line.available)}, 0) = ${fmt(line.shortage)} ${esc(line.unit)}
        </li>`
      )
      .join('');

    return `<section class="plan-card">
      <div class="plan-head">
        <div>
          <div class="plan-title">
            <span class="plan-order">${esc(order.order_id)}</span>
            <span class="plan-product">${esc(order.product_name)}</span>
          </div>
          <p class="plan-meta">${meta}</p>
        </div>
        ${pill}
      </div>
      <div class="table-scroll">
        <table class="plan-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>BOM / unit</th>
              <th>Required</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Shortage</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="plan-foot">
        <details>
          <summary>How these numbers were computed</summary>
          <ul class="calc">${calc}</ul>
        </details>
      </div>
    </section>`;
  }

  // ─── Purchase request draft card ────────────────────────────────────────
  function prCard(pr) {
    const lines = (pr.lines || [])
      .map(
        (line) => `<li>
          <span><strong>${esc(line.material_name)}</strong>
            <span class="mat-id">${esc(line.material_id)}</span></span>
          <span class="pr-qty">${fmt(line.quantity)} ${esc(line.unit)}</span>
        </li>`
      )
      .join('');

    return `<section class="pr-card">
      <div class="pr-head">
        <div>
          <p class="pr-label">Draft purchase request</p>
          <div class="pr-id">${esc(pr.pr_id)}</div>
        </div>
        <span class="pill pill-pending">${esc(pr.status)}</span>
      </div>
      <ul class="pr-lines">${lines}</ul>
      <div class="pr-foot">
        ${ICON.lock}
        <span>Draft only — no purchase order has been created. A planner must approve this request before any PO is issued.</span>
      </div>
    </section>`;
  }

  // ─── Streaming ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (busy || !text.trim()) return;

    busy = true;
    setBusy(true);
    addUserMessage(text);

    const ctx = startAssistantMessage();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        let detail = `HTTP ${res.status}`;
        try {
          detail = (await res.json()).error || detail;
        } catch {
          /* keep status text */
        }
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop();

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;

          let event = '';
          let raw = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) raw += line.slice(5).trim();
          }
          if (!event) continue;

          let data = {};
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }

          handleEvent(event, data, ctx);
        }
      }
    } catch (err) {
      ctx.showError(
        `I could not complete that request. ${err.message}. The demo data has not been modified.`
      );
    } finally {
      ctx.finish();
      busy = false;
      setBusy(false);
      inputEl.focus();
    }
  }

  function handleEvent(event, data, ctx) {
    switch (event) {
      case 'mode':
        setMode(data.mode, data.reason, data.verified);
        if (data.mode === 'offline' && !modeNoticeShown) {
          modeNoticeShown = true;
          ctx.showNotice(
            '<strong>Deterministic mode.</strong> No model credential is configured in this environment, so the order was resolved by rule instead of by the language model. Every quantity comes from the same engine either way.'
          );
        }
        break;

      case 'status':
        ctx.setStatus(data.message);
        break;

      case 'tool_start':
        ctx.addTrace(data.id, data.name, data.input);
        break;

      case 'tool_result':
        ctx.updateTrace(data.id, data.ok, data.error);
        break;

      case 'plan':
        ctx.showPlan(data.plan);
        break;

      case 'text':
        ctx.appendText(data.text);
        break;

      case 'text_delta':
        ctx.appendText(data.text);
        break;

      case 'error':
        ctx.showError(data.error);
        break;

      case 'done':
        if (data.mode) setMode(data.mode, null, data.verified);
        break;

      default:
        break;
    }
  }

  // ─── Composer ───────────────────────────────────────────────────────────
  function setBusy(value) {
    sendBtn.disabled = value || !inputEl.value.trim();
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.disabled = value;
    });
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 132)}px`;
    sendBtn.disabled = busy || !inputEl.value.trim();
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = '';
    autoResize();
    sendMessage(text);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  inputEl.addEventListener('input', autoResize);

  messagesEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || busy) return;
    const message = chip.dataset.message;
    if (!message) return;
    inputEl.value = '';
    autoResize();
    sendMessage(message);
  });

  // ─── Data panel ─────────────────────────────────────────────────────────
  function openPanel() {
    panelEl.classList.add('open');
    panelToggle.setAttribute('aria-expanded', 'true');
    if (window.matchMedia('(max-width: 1080px)').matches) scrim.hidden = false;
  }

  function closePanel() {
    panelEl.classList.remove('open');
    panelToggle.setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
  }

  panelToggle.addEventListener('click', () => {
    const mobile = window.matchMedia('(max-width: 1080px)').matches;

    if (mobile) {
      if (panelEl.classList.contains('open')) closePanel();
      else openPanel();
      return;
    }

    const collapsed = document.body.classList.toggle('panel-collapsed');
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  panelClose.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  function table(headers, rows) {
    return `<table class="data-table">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody>
    </table>`;
  }

  async function loadDemoData() {
    try {
      const res = await fetch('/api/demo-data', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const orders = table(
        ['Order', 'Product', 'Qty'],
        data.orders.map((o) => [o.order_id, o.product_name, `${o.quantity} ${o.unit}`])
      );

      const bom = table(
        ['Material', 'Name', 'Per unit'],
        data.bom.map((b) => [b.material_id, b.material_name, `${b.qty_per_unit} ${b.unit}`])
      );

      const inventory = table(
        ['Material', 'On hand', 'Reserved'],
        data.inventory.map((i) => [i.material_id, `${i.on_hand} ${i.unit}`, i.reserved])
      );

      panelBody.innerHTML = `
        <section class="data-section">
          <h3>Production orders <span>${data.orders.length}</span></h3>
          ${orders}
        </section>
        <section class="data-section">
          <h3>Bill of materials <span>PROD-A</span></h3>
          ${bom}
        </section>
        <section class="data-section">
          <h3>Inventory <span>${data.inventory.length} materials</span></h3>
          ${inventory}
        </section>
        <section class="data-section">
          <h3>Calculation rules</h3>
          <div class="rules">
            required&nbsp;&nbsp;= BOM/unit × qty<br>
            available&nbsp;= max(on_hand − reserved, 0)<br>
            shortage&nbsp;&nbsp;= max(required − available, 0)<br>
            <em>PR lines: shortage &gt; 0 only</em><br>
            <em>PR status: PENDING_HUMAN_APPROVAL</em>
          </div>
        </section>`;
    } catch (err) {
      panelBody.innerHTML = `<p class="panel-loading">Could not load the demo dataset (${esc(
        err.message
      )}).</p>`;
    }
  }

  // ─── Init ───────────────────────────────────────────────────────────────
  setMode('checking');
  autoResize();
  inputEl.focus();

  checkHealth();
  healthTimer = setInterval(() => {
    if (modeBadge.dataset.mode === 'checking') checkHealth();
  }, 1500);
  setTimeout(() => {
    if (healthTimer) clearInterval(healthTimer);
  }, 30000);

  loadDemoData();
})();
