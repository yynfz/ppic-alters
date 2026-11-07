/**
 * PPIC Alter-S — Frontend Application
 *
 * Handles chat UI, SSE streaming from the backend, markdown rendering,
 * and structured display of material plans and PR drafts.
 */

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const demoDataBtn = document.getElementById('demoDataBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const demoDataContent = document.getElementById('demoDataContent');

// ─── State ────────────────────────────────────────────────────────────────────
let isStreaming = false;
let currentMessageEl = null;
let currentContentEl = null;
let currentTextBuffer = '';

// ─── Markdown Renderer (lightweight, no dependencies) ─────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(md) {
  if (!md) return '';

  let html = md;

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Tables (| col | col |)
  html = html.replace(/^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)*)/gm, (match, headerRow, sepRow, bodyRows) => {
    const headers = headerRow.split('|').filter(c => c.trim()).map(c => c.trim());
    const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r =>
      r.split('|').filter(c => c.trim()).map(c => c.trim())
    );

    let tableHtml = '<table><thead><tr>';
    headers.forEach((h, i) => {
      const isShortageCol = h.toLowerCase().includes('shortage');
      tableHtml += `<th>${escapeHtml(h)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    rows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach((cell, i) => {
        const headerLower = headers[i]?.toLowerCase() || '';
        const isShortageCol = headerLower.includes('shortage');
        const numVal = parseInt(cell.replace(/,/g, ''), 10);
        const hasShortage = isShortageCol && !isNaN(numVal) && numVal > 0;
        const noShortage = isShortageCol && !isNaN(numVal) && numVal === 0;
        let cls = isShortageCol ? ' class="shortage-cell' : '';
        if (hasShortage) cls += ' has-shortage';
        else if (noShortage) cls += ' no-shortage';
        if (cls) cls += '"';
        tableHtml += `<td${cls}>${escapeHtml(cell)}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Line breaks (double newline = paragraph, single = <br>)
  html = html.split(/\n\n+/).map(para => {
    if (para.startsWith('<') && !para.startsWith('<li>')) return para;
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

// ─── Chat Functions ───────────────────────────────────────────────────────────
function setStatus(status, text) {
  statusBadge.className = 'status-badge ' + status;
  statusText.textContent = text;
}

function addMessage(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `message message-${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const body = document.createElement('div');
  body.className = 'message-body';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.innerHTML = content;

  body.appendChild(contentEl);
  msgEl.appendChild(avatar);
  msgEl.appendChild(body);
  messagesEl.appendChild(msgEl);

  messagesEl.scrollTop = messagesEl.scrollHeight;
  return contentEl;
}

function addUserMessage(text) {
  addMessage('user', escapeHtml(text));
}

function startAssistantMessage() {
  currentTextBuffer = '';
  const contentEl = addMessage('assistant', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
  currentContentEl = contentEl;
  currentMessageEl = contentEl.closest('.message');
  return contentEl;
}

function appendTextDelta(text) {
  if (!currentContentEl) return;
  // Remove typing indicator if present
  const typing = currentContentEl.querySelector('.typing-indicator');
  if (typing) typing.remove();

  currentTextBuffer += text;
  currentContentEl.innerHTML = renderMarkdown(currentTextBuffer);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addToolCall(toolName, input) {
  if (!currentContentEl) return;
  const typing = currentContentEl.querySelector('.typing-indicator');
  if (typing) typing.remove();

  const toolEl = document.createElement('div');
  toolEl.className = 'tool-call';
  toolEl.id = `tool-${input?.id || Date.now()}`;

  let detailHtml = '';
  if (input?.input) {
    detailHtml = `<div class="tool-call-detail">${escapeHtml(JSON.stringify(input.input, null, 2))}</div>`;
  }

  toolEl.innerHTML = `
    <div class="tool-call-header">
      <span class="tool-icon">🔧</span>
      <span>Calling tool: </span>
      <span class="tool-name">${escapeHtml(toolName)}</span>
    </div>
    ${detailHtml}
    <div class="tool-call-result-loading" style="margin-top:6px;font-size:11px;color:var(--neutral-500);">
      ⏳ Executing...
    </div>
  `;

  currentContentEl.appendChild(toolEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return toolEl;
}

function updateToolResult(toolId, result, isError) {
  const toolEl = document.getElementById(`tool-${toolId}`);
  if (!toolEl) return;

  const loadingEl = toolEl.querySelector('.tool-call-result-loading');
  if (loadingEl) loadingEl.remove();

  const resultEl = document.createElement('div');
  resultEl.className = 'tool-call-result' + (isError ? ' error' : '');

  let resultText = '';
  if (typeof result === 'object' && result !== null) {
    // Format the plan result nicely
    if (result.order && result.lines) {
      resultText = formatPlanResult(result);
    } else if (result.pr_draft || result.pr_id) {
      resultText = formatPRDraft(result);
    } else {
      resultText = JSON.stringify(result, null, 2);
    }
  } else {
    resultText = String(result);
  }

  const icon = isError ? '❌' : '✅';
  resultEl.innerHTML = `${icon} <pre style="margin:4px 0 0;white-space:pre-wrap;">${escapeHtml(resultText)}</pre>`;
  toolEl.appendChild(resultEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatPlanResult(plan) {
  const lines = [];
  lines.push(`Order: ${plan.order.order_id} — ${plan.order.product_name}, ${plan.order.quantity} ${plan.order.unit}`);
  lines.push('');
  lines.push('Material | BOM/u | Required | On-hand | Reserved | Available | Shortage');
  lines.push('---|---|---|---|---|---|---');
  for (const line of plan.lines) {
    lines.push(`${line.material_id} (${line.material_name}) | ${line.qty_per_unit} | ${line.required} | ${line.on_hand} | ${line.reserved} | ${line.available} | ${line.shortage}`);
  }
  if (plan.pr_draft) {
    lines.push('');
    lines.push(`Draft PR: ${plan.pr_draft.pr_id || 'N/A'} — ${plan.pr_draft.status}`);
  }
  return lines.join('\n');
}

function formatPRDraft(pr) {
  const lines = [];
  lines.push(`PR ID: ${pr.pr_id || 'N/A'}`);
  lines.push(`Status: ${pr.status}`);
  lines.push(`Order: ${pr.order_id}`);
  if (pr.lines && pr.lines.length > 0) {
    lines.push('');
    lines.push('Lines:');
    pr.lines.forEach(line => {
      lines.push(`  - ${line.material_id} (${line.material_name}): ${line.quantity} ${line.unit}`);
    });
  }
  if (pr.note) lines.push(`\nNote: ${pr.note}`);
  return lines.join('\n');
}

function finalizeAssistantMessage() {
  // Remove typing indicator if still present
  if (currentContentEl) {
    const typing = currentContentEl.querySelector('.typing-indicator');
    if (typing) {
      typing.remove();
      if (!currentTextBuffer) {
        currentContentEl.innerHTML = '<p>(No response)</p>';
      }
    }
  }
  currentMessageEl = null;
  currentContentEl = null;
  currentTextBuffer = '';
}

// ─── SSE Streaming ────────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (isStreaming || !text.trim()) return;

  isStreaming = true;
  sendBtn.disabled = true;
  setStatus('thinking', 'Thinking...');

  addUserMessage(text);
  startAssistantMessage();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const events = buffer.split('\n\n');
      buffer = events.pop(); // Keep incomplete event

      for (const eventStr of events) {
        if (!eventStr.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of eventStr.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7);
          else if (line.startsWith('data: ')) eventData = line.slice(6);
        }

        if (!eventType) continue;

        let data;
        try { data = JSON.parse(eventData); } catch { data = { raw: eventData }; }

        handleSSEEvent(eventType, data);
      }
    }
  } catch (err) {
    console.error('Chat error:', err);
    if (currentContentEl) {
      const typing = currentContentEl.querySelector('.typing-indicator');
      if (typing) typing.remove();
      currentContentEl.innerHTML += `<p style="color:var(--danger);">⚠️ Error: ${escapeHtml(err.message)}</p>`;
    }
    setStatus('error', 'Error');
  } finally {
    finalizeAssistantMessage();
    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
    setStatus('connected', 'Connected');
  }
}

function handleSSEEvent(event, data) {
  switch (event) {
    case 'status':
      setStatus('thinking', data.message || 'Processing...');
      break;

    case 'text_delta':
      appendTextDelta(data.text);
      break;

    case 'tool_start':
    case 'tool_use':
      // Only add tool call UI once (tool_start fires first, tool_use has full input)
      if (event === 'tool_use') {
        const existing = document.getElementById(`tool-${data.id}`);
        if (existing) {
          // Update with full input
          const detailEl = existing.querySelector('.tool-call-detail');
          if (detailEl && data.input) {
            detailEl.textContent = JSON.stringify(data.input, null, 2);
          }
        } else {
          addToolCall(data.name, data);
        }
      } else {
        addToolCall(data.name, { id: data.id });
      }
      break;

    case 'tool_result':
      updateToolResult(data.id, data.result, data.is_error);
      break;

    case 'result':
      // Turn complete
      break;

    case 'error':
      if (currentContentEl) {
        const typing = currentContentEl.querySelector('.typing-indicator');
        if (typing) typing.remove();
        currentContentEl.innerHTML += `<p style="color:var(--danger);">⚠️ ${escapeHtml(data.error)}</p>`;
      }
      setStatus('error', 'Error');
      break;

    case 'done':
      break;
  }
}

// ─── Demo Data Sidebar ────────────────────────────────────────────────────────
async function loadDemoData() {
  try {
    const res = await fetch('/api/demo-data');
    const data = await res.json();

    demoDataContent.innerHTML = '';

    // Orders
    const ordersSection = document.createElement('div');
    ordersSection.className = 'data-section';
    ordersSection.innerHTML = '<h3><span class="file-icon">📋</span> Production Orders</h3>';
    const ordersTable = parseCSV(data.files['orders.csv']);
    ordersSection.appendChild(renderCSVTable(ordersTable));
    demoDataContent.appendChild(ordersSection);

    // BOM
    const bomSection = document.createElement('div');
    bomSection.className = 'data-section';
    bomSection.innerHTML = '<h3><span class="file-icon">🏗️</span> Bill of Materials</h3>';
    const bomTable = parseCSV(data.files['bom.csv']);
    bomSection.appendChild(renderCSVTable(bomTable));
    demoDataContent.appendChild(bomSection);

    // Inventory
    const invSection = document.createElement('div');
    invSection.className = 'data-section';
    invSection.innerHTML = '<h3><span class="file-icon">📦</span> Inventory</h3>';
    const invTable = parseCSV(data.files['inventory.csv']);
    invSection.appendChild(renderCSVTable(invTable));
    demoDataContent.appendChild(invSection);

    // Rules
    const rulesSection = document.createElement('div');
    rulesSection.className = 'data-section';
    rulesSection.innerHTML = `
      <h3><span class="file-icon">📐</span> Calculation Rules</h3>
      <div style="font-size:12px;color:var(--neutral-600);line-height:1.8;">
        <code>required = BOM/unit × qty</code><br>
        <code>available = max(on_hand − reserved, 0)</code><br>
        <code>shortage = max(required − available, 0)</code>
      </div>
    `;
    demoDataContent.appendChild(rulesSection);
  } catch (err) {
    demoDataContent.innerHTML = `<p class="loading-text">Failed to load demo data.</p>`;
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => line.split(','));
  return { headers, rows };
}

function renderCSVTable({ headers, rows }) {
  let html = '<table class="data-table"><thead><tr>';
  headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => html += `<td>${escapeHtml(cell)}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (text) {
    sendMessage(text);
    inputEl.value = '';
    autoResize();
  }
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

inputEl.addEventListener('input', autoResize);

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  sendBtn.disabled = isStreaming || !inputEl.value.trim();
}

// Suggestion chips
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('chip')) {
    const msg = e.target.dataset.message;
    inputEl.value = msg;
    autoResize();
    sendMessage(msg);
    inputEl.value = '';
    autoResize();
  }
});

// Sidebar toggle
demoDataBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  if (sidebar.classList.contains('open') && !demoDataContent.querySelector('.data-section')) {
    loadDemoData();
  }
});

closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.remove('open');
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      setStatus('connected', 'Connected');
    } else {
      setStatus('error', 'Server error');
    }
  } catch {
    setStatus('error', 'Disconnected');
  }
}

checkHealth();
autoResize();
inputEl.focus();
