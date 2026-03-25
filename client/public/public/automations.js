/**
 * Nanobot Automations — injected into LibreChat sidebar.
 * Adds an "Automations" button above the Agent Marketplace.
 * Opens a full-page panel with cron job management.
 */
(function () {
  'use strict';

  const API_BASE = 'http://localhost:18790';
  const BUTTON_ID = 'nanobot-automations-btn';
  const PANEL_ID = 'nanobot-automations-panel';

  // ─── Helpers ───────────────────────────────────────────────
  function humanSchedule(s) {
    if (s.kind === 'at') {
      if (!s.atMs) return 'one-time';
      return 'at ' + new Date(s.atMs).toLocaleString();
    }
    if (s.kind === 'every') {
      const mins = Math.round((s.everyMs || 0) / 60000);
      if (mins < 60) return 'every ' + mins + 'm';
      return 'every ' + Math.round(mins / 60) + 'h';
    }
    if (s.kind === 'cron') {
      const tz = s.tz ? ' ' + s.tz.replace('America/', '') : '';
      return (s.expr || '') + tz;
    }
    return s.kind;
  }

  function timeAgo(ms) {
    if (!ms) return 'never';
    const d = Date.now() - ms;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }

  function timeUntil(ms) {
    if (!ms) return '\u2014';
    const d = ms - Date.now();
    if (d < 0) return 'overdue';
    if (d < 60000) return '<1m';
    if (d < 3600000) return Math.floor(d / 60000) + 'm';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ' + Math.floor((d % 3600000) / 60000) + 'm';
    return Math.floor(d / 86400000) + 'd';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ─── Styles ────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('nanobot-auto-styles')) return;
    const style = document.createElement('style');
    style.id = 'nanobot-auto-styles';
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: #0a0a0c;
        color: #e8e8ed;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow-y: auto;
        animation: nanobotSlideIn .2s ease-out;
      }
      @keyframes nanobotSlideIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #${PANEL_ID} .na-wrap {
        max-width: 720px;
        margin: 0 auto;
        padding: 40px 24px 80px;
      }
      #${PANEL_ID} .na-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 36px;
      }
      #${PANEL_ID} .na-title {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -.3px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #${PANEL_ID} .na-title .pulse {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 6px #22c55e;
        animation: naPulse 2s infinite;
      }
      @keyframes naPulse {
        0%,100% { opacity:1; }
        50% { opacity:.4; }
      }
      #${PANEL_ID} .na-close {
        background: #1c1c22;
        border: 1px solid #2a2a33;
        border-radius: 8px;
        color: #8888a0;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 14px;
        cursor: pointer;
        transition: all .15s;
      }
      #${PANEL_ID} .na-close:hover {
        border-color: #555;
        color: #e8e8ed;
      }
      #${PANEL_ID} .na-meta {
        font-size: 12px;
        color: #8888a0;
        margin-top: 4px;
        font-family: 'SF Mono', 'Menlo', monospace;
      }
      #${PANEL_ID} .na-jobs {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      #${PANEL_ID} .na-job {
        background: #141418;
        border: 1px solid #2a2a33;
        border-radius: 10px;
        padding: 18px 22px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        align-items: center;
        transition: border-color .15s;
      }
      #${PANEL_ID} .na-job:hover {
        border-color: #3a3a44;
      }
      #${PANEL_ID} .na-job.disabled {
        opacity: .4;
      }
      #${PANEL_ID} .na-job-name {
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      #${PANEL_ID} .na-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #${PANEL_ID} .na-dot.ok { background: #22c55e; box-shadow: 0 0 5px #22c55e; }
      #${PANEL_ID} .na-dot.error { background: #ef4444; box-shadow: 0 0 5px #ef4444; }
      #${PANEL_ID} .na-dot.pending { background: #8888a0; }
      #${PANEL_ID} .na-details {
        font-family: 'SF Mono','Menlo',monospace;
        font-size: 11px;
        color: #8888a0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin-top: 5px;
      }
      #${PANEL_ID} .na-actions {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-shrink: 0;
      }
      /* Toggle */
      #${PANEL_ID} .na-toggle {
        position: relative;
        width: 36px; height: 20px;
        cursor: pointer;
        display: inline-block;
      }
      #${PANEL_ID} .na-toggle input { opacity:0; width:0; height:0; position:absolute; }
      #${PANEL_ID} .na-toggle .sl {
        position: absolute; inset:0;
        background: #1c1c22;
        border: 1px solid #2a2a33;
        border-radius: 10px;
        transition: .2s;
      }
      #${PANEL_ID} .na-toggle .sl::before {
        content:'';
        position: absolute;
        height: 14px; width: 14px;
        left: 2px; top: 2px;
        background: #8888a0;
        border-radius: 50%;
        transition: .2s;
      }
      #${PANEL_ID} .na-toggle input:checked + .sl {
        background: rgba(255,107,53,.13);
        border-color: #ff6b35;
      }
      #${PANEL_ID} .na-toggle input:checked + .sl::before {
        transform: translateX(16px);
        background: #ff6b35;
      }
      /* Buttons */
      #${PANEL_ID} .na-btn {
        font-family: 'SF Mono','Menlo',monospace;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 10px;
        border: 1px solid #2a2a33;
        border-radius: 6px;
        background: #1c1c22;
        color: #8888a0;
        cursor: pointer;
        transition: all .15s;
        white-space: nowrap;
      }
      #${PANEL_ID} .na-btn:hover {
        border-color: #8888a0;
        color: #e8e8ed;
      }
      #${PANEL_ID} .na-btn.run:hover {
        border-color: #22c55e;
        color: #22c55e;
        background: rgba(34,197,94,.08);
      }
      #${PANEL_ID} .na-btn.del:hover {
        border-color: #ef4444;
        color: #ef4444;
        background: rgba(239,68,68,.08);
      }
      #${PANEL_ID} .na-btn:disabled {
        opacity: .3;
        cursor: not-allowed;
      }
      #${PANEL_ID} .na-btn.running {
        color: #eab308;
        border-color: #eab308;
      }
      #${PANEL_ID} .na-empty {
        text-align: center;
        padding: 48px 20px;
        color: #8888a0;
        font-size: 13px;
      }
      #${PANEL_ID} .na-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #141418;
        border: 1px solid #2a2a33;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 12px;
        color: #e8e8ed;
        transform: translateY(60px);
        opacity: 0;
        transition: all .25s;
        z-index: 210;
      }
      #${PANEL_ID} .na-toast.show {
        transform: translateY(0);
        opacity: 1;
      }
      #${PANEL_ID} .na-toast.err { border-color: #ef4444; }

      /* Sidebar button — matches LibreChat's marketplace button exactly */
      #${BUTTON_ID} {
        position: relative;
        display: flex;
        width: 100%;
        cursor: pointer;
        align-items: center;
        justify-content: space-between;
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        line-height: 1.25rem;
        outline: none;
        color: var(--text-primary);
      }
      #${BUTTON_ID}:hover {
        background: var(--surface-active-alt, rgba(255,255,255,0.06));
      }
      #${BUTTON_ID}:focus-visible {
        outline: 2px solid;
        outline-offset: -2px;
      }

      @media (max-width: 640px) {
        #${PANEL_ID} .na-job {
          grid-template-columns: 1fr;
        }
        #${PANEL_ID} .na-actions {
          justify-content: flex-end;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel ─────────────────────────────────────────────────
  let refreshInterval = null;

  function showPanel() {
    if (document.getElementById(PANEL_ID)) return;
    injectStyles();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="na-wrap">
        <div class="na-header">
          <div>
            <div class="na-title"><span class="pulse"></span>Automations</div>
            <div class="na-meta">nanobot cron service</div>
          </div>
          <button class="na-close" id="na-close-btn">\u2190 Back to chat</button>
        </div>
        <div style="padding:0 24px 12px;display:flex;gap:8px;">
          <button id="na-open-ig-template" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid #FFD600;background:rgba(255,214,0,0.1);color:#FFD600;font-size:13px;font-weight:600;font-family:Rubik,sans-serif;cursor:pointer;transition:background 0.15s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            IG Template
          </button>
        </div>
        <div id="na-jobs" class="na-jobs">
          <div class="na-empty">Loading\u2026</div>
        </div>
      </div>
      <div id="na-toast" class="na-toast"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('na-close-btn').onclick = closePanel;

    // IG Template button: close automations panel and open IG Template panel
    document.getElementById('na-open-ig-template').addEventListener('click', function() {
      closePanel();
      // Trigger IG Template panel via its global showPanel function
      if (typeof window.__svTemplateShowPanel === 'function') {
        window.__svTemplateShowPanel();
      }
    });

    // Esc to close
    panel._keyHandler = function (e) {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', panel._keyHandler);

    fetchJobs();
    refreshInterval = setInterval(fetchJobs, 30000);
  }

  function closePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    if (panel._keyHandler) document.removeEventListener('keydown', panel._keyHandler);
    panel.remove();
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  function toast(msg, isErr) {
    const el = document.getElementById('na-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'na-toast show' + (isErr ? ' err' : '');
    setTimeout(() => { el.className = 'na-toast'; }, 2400);
  }

  async function fetchJobs() {
    try {
      const res = await fetch(API_BASE + '/api/cron/jobs');
      const data = await res.json();
      renderJobs(data.jobs || []);
    } catch (e) {
      toast('Failed to load jobs', true);
    }
  }

  function renderJobs(jobs) {
    const el = document.getElementById('na-jobs');
    if (!el) return;
    if (!jobs.length) {
      el.innerHTML = '<div class="na-empty">No scheduled jobs</div>';
      return;
    }
    el.innerHTML = jobs.map(function (j) {
      const st = j.state && j.state.lastStatus;
      const dotCls = !st ? 'pending' : st === 'ok' ? 'ok' : 'error';
      return '<div class="na-job ' + (j.enabled ? '' : 'disabled') + '">' +
        '<div>' +
          '<div class="na-job-name"><span class="na-dot ' + dotCls + '"></span>' + esc(j.name) + '</div>' +
          '<div class="na-details">' +
            '<span>' + esc(humanSchedule(j.schedule)) + '</span>' +
            '<span>next: ' + (j.enabled ? timeUntil(j.state && j.state.nextRunAtMs) : 'paused') + '</span>' +
            '<span>last: ' + timeAgo(j.state && j.state.lastRunAtMs) + '</span>' +
            (j.state && j.state.lastError ? '<span style="color:#ef4444">' + esc(j.state.lastError.slice(0, 50)) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="na-actions">' +
          '<label class="na-toggle">' +
            '<input type="checkbox" ' + (j.enabled ? 'checked' : '') + ' onchange="window.__naToggle(\'' + j.id + '\',this.checked)">' +
            '<span class="sl"></span>' +
          '</label>' +
          '<button class="na-btn run" onclick="window.__naRun(\'' + j.id + '\',this)" ' + (!j.enabled ? 'disabled' : '') + '>run now</button>' +
          '<button class="na-btn del" onclick="window.__naDel(\'' + j.id + '\')">delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Global handlers (called from inline onclick)
  window.__naToggle = async function (id, enabled) {
    try {
      await fetch(API_BASE + '/api/cron/jobs/' + id + '/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabled }),
      });
      toast(enabled ? 'Job enabled' : 'Job paused');
      fetchJobs();
    } catch (e) { toast('Toggle failed', true); fetchJobs(); }
  };

  window.__naRun = async function (id, btn) {
    btn.disabled = true;
    btn.textContent = 'running\u2026';
    btn.classList.add('running');
    try {
      await fetch(API_BASE + '/api/cron/jobs/' + id + '/run', { method: 'POST' });
      toast('Job executed');
    } catch (e) { toast('Run failed', true); }
    fetchJobs();
  };

  window.__naDel = async function (id) {
    if (!confirm('Delete this job?')) return;
    try {
      await fetch(API_BASE + '/api/cron/jobs/' + id, { method: 'DELETE' });
      toast('Job deleted');
      fetchJobs();
    } catch (e) { toast('Delete failed', true); }
  };

  // ─── Sidebar injection ────────────────────────────────────
  const AUTOMATION_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>';

  function createButton() {
    const btn = document.createElement('div');
    btn.id = BUTTON_ID;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Automations');
    // Match marketplace button structure: outer group div > inner flex div > icon + text
    btn.innerHTML =
      '<div style="display:flex;flex:1;align-items:center;overflow:hidden;padding-right:1.5rem">' +
        '<div style="margin-right:0.5rem;width:1.25rem;height:1.25rem;flex-shrink:0">' + AUTOMATION_SVG + '</div>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Automations</span>' +
      '</div>';
    btn.addEventListener('click', function (e) { e.stopPropagation(); showPanel(); }, true);
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); showPanel(); }
    }, true);
    return btn;
  }

  function isCorrectParent(el) {
    // The button can be a direct child of the flex-1 wrapper, inside the unified-nav wrap, or in the static section
    var p = el && el.parentElement;
    if (!p) return false;
    if (p.id === 'sv-sidebar-nav-wrap') return true;
    if (p.id === 'sv-sidebar-static') return true;
    return p.classList.contains('flex-1') && p.classList.contains('overflow-hidden');
  }

  function doInject() {
    try {
      // Remove any incorrectly-placed instances
      document.querySelectorAll('#' + BUTTON_ID).forEach(function (el) {
        if (!isCorrectParent(el)) el.remove();
      });

      // Already correctly placed?
      if (document.getElementById(BUTTON_ID)) return;

      var nav = document.getElementById('chat-history-nav');
      if (!nav) return;

      // nav > div.flex-1.overflow-hidden
      var outerWrapper = nav.firstElementChild;
      if (!outerWrapper || !outerWrapper.classList.contains('flex-1') || !outerWrapper.classList.contains('overflow-hidden')) return;

      // Insert into the static-2 section (created by unified-nav.js) if available
      var staticSection = document.getElementById('sv-sidebar-static');
      if (staticSection) {
        injectStyles();
        var btn = createButton();
        staticSection.appendChild(btn);
        return;
      }

      // Fallback: find div.min-h-0.flex-grow among direct children
      var scrollContainer = null;
      for (var i = 0; i < outerWrapper.children.length; i++) {
        var child = outerWrapper.children[i];
        if (child.classList.contains('flex-grow') && child.classList.contains('min-h-0')) {
          scrollContainer = child;
          break;
        }
      }
      if (!scrollContainer) return;

      injectStyles();
      var btn = createButton();
      outerWrapper.insertBefore(btn, scrollContainer);
    } catch (e) {
      // Swallow DOM errors — React may be mid-reconciliation
    }
  }

  // Poll-based injection — more reliable than MutationObserver against React reconciliation
  var _pollId = setInterval(function () {
    doInject();
  }, 600);

  // Also try on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(doInject, 500); });
  } else {
    setTimeout(doInject, 500);
  }
})();
