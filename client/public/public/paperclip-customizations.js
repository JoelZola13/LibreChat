/**
 * Street Voices — Paperclip Customizations
 * Injected into Paperclip pages via nginx sub_filter.
 * 1. Renames "Issues" → "Tasks" throughout the UI
 * 2. Adds an "Employees" section to the sidebar with clickable member profiles
 */
(function () {
  'use strict';

  // ─── Team Members ──────────────────────────────────────────
  // Joel's real human team — edit this list to add/remove people
  var TEAM = [
    {
      name: 'Joel', role: 'Founder & CEO', initials: 'JZ', color: '#ff6b35',
      email: 'joel@streetvoices.ca', status: 'active', timezone: 'Eastern (ET)',
      bio: 'Founder of Street Voices. Building the future of AI-powered creative platforms.',
      responsibilities: ['Strategy & Vision', 'Product Direction', 'Team Leadership', 'Partnership Development'],
      channels: { slack: true, email: true, whatsapp: true },
    },
    {
      name: 'Nanobot', role: 'AI Platform', initials: 'NB', color: '#22c55e',
      email: null, status: 'active', timezone: 'Always On',
      bio: 'Ultra-lightweight AI agent framework powering 37 specialized agents across all operations.',
      responsibilities: ['Agent Orchestration', 'Task Execution', 'Communication Management', 'Automation'],
      channels: { slack: true, email: true, whatsapp: true },
    },
  ];

  // ─── Issues → Tasks Renaming ───────────────────────────────
  var RENAME_MAP = {
    'Issues': 'Tasks',
    'issues': 'tasks',
    'Issue': 'Task',
    'issue': 'task',
    'New Issue': 'New Task',
    'new issue': 'new task',
    'No issues': 'No tasks',
    'Assign Issue': 'Assign Task',
    'assigned issues': 'assigned tasks',
    'Assigned Issues': 'Assigned Tasks',
    'Recent Issues': 'Recent Tasks',
    'Issues by Priority': 'Tasks by Priority',
    'Issues by Status': 'Tasks by Status',
    'No assigned issues': 'No assigned tasks',
    'No assigned issues.': 'No assigned tasks.',
  };

  function renameText(node) {
    if (node.nodeType === 3) {
      var text = node.textContent;
      var changed = false;
      for (var orig in RENAME_MAP) {
        if (text.indexOf(orig) !== -1) {
          text = text.split(orig).join(RENAME_MAP[orig]);
          changed = true;
        }
      }
      if (changed) node.textContent = text;
    } else if (node.nodeType === 1 && node.childNodes) {
      var tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return;
      for (var i = 0; i < node.childNodes.length; i++) {
        renameText(node.childNodes[i]);
      }
    }
  }

  function renameAttributes(root) {
    var els = root.querySelectorAll('[placeholder], [title], [aria-label]');
    for (var i = 0; i < els.length; i++) {
      ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
        var val = els[i].getAttribute(attr);
        if (!val) return;
        for (var orig in RENAME_MAP) {
          if (val.indexOf(orig) !== -1) {
            els[i].setAttribute(attr, val.split(orig).join(RENAME_MAP[orig]));
          }
        }
      });
    }
  }

  // ─── Hide "Goals" from sidebar ──────────────────────────────
  function hideGoals() {
    // Find all sidebar links/buttons that say "Goals" and hide them
    document.querySelectorAll('a, button, [role="button"]').forEach(function(el) {
      var text = el.textContent.trim();
      if (text === 'Goals') {
        // Hide the entire nav item (may be wrapped in a parent li or div)
        var target = el;
        if (el.parentElement && (el.parentElement.tagName === 'LI' || el.parentElement.children.length === 1)) {
          target = el.parentElement;
        }
        target.style.display = 'none';
      }
    });
  }

  // ─── Employee Profile (inline, replaces main content like agent profiles) ──
  var savedMainContent = null;
  var activeEmployeeSlug = null;

  function findMainContent() {
    // Strategy: find the sidebar element first, then get its sibling (the main content area).
    // The sidebar is the narrow left panel; main content is the wide right panel.
    var teamSection = document.getElementById('sv-team-section');
    if (teamSection) {
      // Walk up from our injected section to find the sidebar container
      var sidebar = teamSection;
      for (var up = 0; up < 10; up++) {
        sidebar = sidebar.parentElement;
        if (!sidebar) break;
        var sw = sidebar.offsetWidth;
        // Sidebar is typically 200-350px wide
        if (sw > 150 && sw < 400 && sidebar.offsetHeight > 300) {
          // Found the sidebar — now find its sibling (the main content)
          var parent = sidebar.parentElement;
          if (parent) {
            var kids = parent.children;
            for (var c = 0; c < kids.length; c++) {
              if (kids[c] !== sidebar && kids[c].offsetWidth > 400) {
                return kids[c];
              }
            }
          }
          break;
        }
      }
    }

    // Fallback: find layout with sidebar + content pattern
    var allDivs = document.querySelectorAll('div');
    for (var i = 0; i < allDivs.length; i++) {
      var el = allDivs[i];
      var style = window.getComputedStyle(el);
      // Look for a flex/grid container with exactly 2 main children (sidebar + content)
      if ((style.display === 'flex' || style.display === 'grid') && el.children.length >= 2) {
        var narrow = null, wide = null;
        for (var k = 0; k < el.children.length; k++) {
          var child = el.children[k];
          if (child.offsetWidth > 100 && child.offsetWidth < 400 && child.offsetHeight > 300) narrow = child;
          if (child.offsetWidth > 400 && child.offsetHeight > 300) wide = child;
        }
        if (narrow && wide) return wide;
      }
    }
    return null;
  }

  function openEmployeeProfile(member) {
    var slug = member.name.toLowerCase().replace(/\s+/g, '-');

    // Find the main content area
    var main = findMainContent();
    if (!main) {
      // Last resort: navigate to a dedicated URL
      alert('Could not find main content area');
      return;
    }

    // Save original content so we can restore it
    if (!savedMainContent) {
      savedMainContent = { element: main, html: main.innerHTML, scroll: main.scrollTop };
    }
    activeEmployeeSlug = slug;

    // Replace main content with employee profile matching agent profile layout
    main.scrollTop = 0;
    main.innerHTML = buildProfileHTML(member);

    // Wire up tab switching
    main.querySelectorAll('[data-emp-tab]').forEach(function (tab) {
      tab.onclick = function () {
        main.querySelectorAll('[data-emp-tab]').forEach(function (t) {
          t.style.color = '#71717a';
          t.style.borderBottomColor = 'transparent';
        });
        tab.style.color = '#fafafa';
        tab.style.borderBottomColor = '#fafafa';
        renderEmployeeTab(main.querySelector('#sv-emp-tab-content'), member, tab.dataset.empTab);
      };
    });

    renderEmployeeTab(main.querySelector('#sv-emp-tab-content'), member, 'dashboard');

    // Highlight employee in sidebar
    highlightSidebarEmployee(slug);
  }

  function buildProfileHTML(member) {
    var statusColor = member.status === 'active' ? '#22c55e' : '#eab308';
    var statusBg = member.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)';
    var statusBorder = member.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)';

    return '<div style="padding:28px 32px 20px;display:flex;align-items:flex-start;gap:20px">' +
      '<div style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;flex-shrink:0;background:' + member.color + '">' + esc(member.initials) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<h1 style="font-size:22px;font-weight:700;color:#fafafa;margin:0 0 2px">' + esc(member.name) + '</h1>' +
        '<p style="font-size:14px;color:#71717a;margin:0">' + esc(member.role) + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:500;background:' + statusBg + ';color:' + statusColor + ';border:1px solid ' + statusBorder + '">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:' + statusColor + ';box-shadow:0 0 4px ' + statusColor + '"></span>' +
          (member.status === 'active' ? 'active' : 'away') +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:0;padding:0 32px;border-bottom:1px solid #27272a">' +
      '<button data-emp-tab="dashboard" style="padding:12px 16px;font-size:14px;color:#fafafa;cursor:pointer;border:none;border-bottom:2px solid #fafafa;background:none;font-family:inherit">Dashboard</button>' +
      '<button data-emp-tab="configuration" style="padding:12px 16px;font-size:14px;color:#71717a;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;font-family:inherit">Configuration</button>' +
      '<button data-emp-tab="runs" style="padding:12px 16px;font-size:14px;color:#71717a;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;font-family:inherit">Runs</button>' +
    '</div>' +
    '<div id="sv-emp-tab-content" style="padding:24px 32px"></div>';
  }

  function renderEmployeeTab(container, member, tab) {
    if (!container) return;

    if (tab === 'dashboard') {
      container.innerHTML =
        // Quick stats row (matching agent dashboard cards)
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">' +
          '<div style="background:#27272a;border-radius:10px;padding:16px">' +
            '<div style="font-size:12px;color:#71717a;margin-bottom:6px">Tasks Assigned</div>' +
            '<div style="font-size:20px;font-weight:600;color:#fafafa">—</div>' +
          '</div>' +
          '<div style="background:#27272a;border-radius:10px;padding:16px">' +
            '<div style="font-size:12px;color:#71717a;margin-bottom:6px">Tasks Completed</div>' +
            '<div style="font-size:20px;font-weight:600;color:#22c55e">—</div>' +
          '</div>' +
          '<div style="background:#27272a;border-radius:10px;padding:16px">' +
            '<div style="font-size:12px;color:#71717a;margin-bottom:6px">Agents Supervised</div>' +
            '<div style="font-size:20px;font-weight:600;color:#fafafa">' + (member.name === 'Joel' ? '37' : '—') + '</div>' +
          '</div>' +
          '<div style="background:#27272a;border-radius:10px;padding:16px">' +
            '<div style="font-size:12px;color:#71717a;margin-bottom:6px">Member Since</div>' +
            '<div style="font-size:20px;font-weight:600;color:#fafafa">Mar 2026</div>' +
          '</div>' +
        '</div>' +

        // About section
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">About</h3>' +
          '<div style="font-size:14px;line-height:1.6;color:#a1a1aa;padding:14px 16px;background:#27272a;border-radius:10px">' + esc(member.bio || 'No bio set.') + '</div>' +
        '</div>' +

        // Details
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Details</h3>' +
          '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
            '<span style="font-size:13px;color:#a1a1aa"><strong style="color:#e4e4e7;font-weight:500">Timezone:</strong> ' + esc(member.timezone || 'N/A') + '</span>' +
            (member.email ? '<span style="font-size:13px;color:#a1a1aa"><strong style="color:#e4e4e7;font-weight:500">Email:</strong> ' + esc(member.email) + '</span>' : '') +
          '</div>' +
        '</div>' +

        // Channels
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Channels</h3>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            buildChannelPill('Slack', member.channels && member.channels.slack) +
            buildChannelPill('Email', member.channels && member.channels.email) +
            buildChannelPill('WhatsApp', member.channels && member.channels.whatsapp) +
          '</div>' +
        '</div>' +

        // Responsibilities
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Responsibilities</h3>' +
          (member.responsibilities || []).map(function (r) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:#27272a;margin-bottom:8px">' +
              '<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + member.color + '"></span>' +
              '<span style="font-size:13px;color:#e4e4e7">' + esc(r) + '</span></div>';
          }).join('') +
        '</div>';

    } else if (tab === 'configuration') {
      container.innerHTML =
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Role Configuration</h3>' +
          '<div style="background:#27272a;border-radius:10px;padding:20px">' +
            '<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;font-size:13px">' +
              '<span style="color:#71717a">Name</span><span style="color:#e4e4e7">' + esc(member.name) + '</span>' +
              '<span style="color:#71717a">Role</span><span style="color:#e4e4e7">' + esc(member.role) + '</span>' +
              '<span style="color:#71717a">Email</span><span style="color:#e4e4e7">' + esc(member.email || 'N/A') + '</span>' +
              '<span style="color:#71717a">Timezone</span><span style="color:#e4e4e7">' + esc(member.timezone || 'N/A') + '</span>' +
              '<span style="color:#71717a">Status</span><span style="color:#22c55e">' + esc(member.status || 'active') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Notification Preferences</h3>' +
          '<div style="color:#71717a;font-size:13px;padding:24px;text-align:center;background:#27272a;border-radius:10px">' +
            'Notification settings coming soon.' +
          '</div>' +
        '</div>';

    } else if (tab === 'runs') {
      container.innerHTML =
        '<div style="margin-bottom:24px">' +
          '<h3 style="font-size:14px;font-weight:600;color:#fafafa;margin:0 0 12px">Run History</h3>' +
          '<div style="color:#71717a;font-size:13px;padding:24px;text-align:center;background:#27272a;border-radius:10px">' +
            'Employee activity log coming soon. This will show task assignments, approvals, and agent interactions.' +
          '</div>' +
        '</div>';
    }
  }

  function buildChannelPill(name, active) {
    var dotColor = active ? '#22c55e' : '#71717a';
    var dotShadow = active ? 'box-shadow:0 0 4px #22c55e;' : '';
    return '<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;background:#27272a;color:#a1a1aa">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + dotColor + ';' + dotShadow + '"></span>' + name + '</div>';
  }

  function highlightSidebarEmployee(slug) {
    // Remove active state from agents in sidebar, highlight selected employee
    var section = document.getElementById('sv-team-section');
    if (!section) return;
    var rows = section.querySelectorAll('div[style*="cursor:pointer"], div[style*="cursor: pointer"]');
    rows.forEach(function (row) {
      var nameEl = row.querySelector('span');
      if (nameEl) {
        var rowSlug = nameEl.textContent.trim().toLowerCase().replace(/\s+/g, '-');
        if (rowSlug === slug) {
          row.style.background = 'rgba(255,255,255,0.08)';
        } else {
          row.style.background = 'none';
        }
      }
    });
  }

  function restoreMainContent() {
    if (savedMainContent) {
      savedMainContent.element.innerHTML = savedMainContent.html;
      savedMainContent.element.scrollTop = savedMainContent.scroll || 0;
      savedMainContent = null;
      activeEmployeeSlug = null;
    }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ─── Employees Section Injection ─────────────────────────────
  function injectTeamSection() {
    if (document.getElementById('sv-team-section')) return;

    // Find the sidebar by multiple strategies
    var sidebar = null;

    // Strategy 1: Look for Paperclip's sidebar nav
    sidebar = document.querySelector('nav[class*="sidebar"], aside[class*="sidebar"], [class*="Sidebar"], [data-testid="sidebar"]');

    // Strategy 2: Find by AGENTS/PROJECTS section text (before or after our rename)
    if (!sidebar) {
      var allSpans = document.querySelectorAll('span, div, h3, h4, p');
      for (var i = 0; i < allSpans.length; i++) {
        var t = allSpans[i].textContent.trim().toUpperCase();
        if (t === 'AGENTS' || t === 'PROJECTS' || t === 'WORK') {
          // Walk up to find the scrollable sidebar container
          var el = allSpans[i];
          for (var up = 0; up < 8; up++) {
            el = el.parentElement;
            if (!el) break;
            // Sidebar is typically a narrow, scrollable container
            var w = el.offsetWidth;
            var h = el.offsetHeight;
            if (w > 150 && w < 400 && h > 300) {
              sidebar = el;
              break;
            }
          }
          if (sidebar) break;
        }
      }
    }

    if (!sidebar) return;

    // Find the AGENTS heading to insert EMPLOYEES before it
    var agentsHeader = null;
    var allEls = sidebar.querySelectorAll('*');
    for (var j = 0; j < allEls.length; j++) {
      var txt = allEls[j].textContent.trim().toUpperCase();
      if ((txt === 'AGENTS' || txt === 'AGENTS+') && allEls[j].children.length <= 1) {
        agentsHeader = allEls[j];
        break;
      }
    }

    var section = document.createElement('div');
    section.id = 'sv-team-section';
    section.style.cssText = 'padding: 8px 12px; margin-bottom: 4px;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 8px;margin-bottom:4px;';
    header.innerHTML = '<span style="font-size:11px;font-weight:600;letter-spacing:0.05em;color:#71717a;text-transform:uppercase">Employees</span>';
    section.appendChild(header);

    TEAM.forEach(function (member) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s;';
      row.onmouseenter = function () { row.style.background = 'rgba(255,255,255,0.05)'; };
      row.onmouseleave = function () { row.style.background = 'none'; };
      row.onclick = function () { openEmployeeProfile(member); };

      var avatar = document.createElement('div');
      avatar.style.cssText = 'width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;flex-shrink:0;background:' + member.color + ';';
      avatar.textContent = member.initials;

      var info = document.createElement('div');
      info.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
      info.innerHTML = '<span style="font-size:13px;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(member.name) + '</span>' +
        '<span style="font-size:11px;color:#71717a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(member.role) + '</span>';

      var status = document.createElement('div');
      status.style.cssText = 'width:8px;height:8px;border-radius:50%;margin-left:auto;flex-shrink:0;background:#22c55e;box-shadow:0 0 4px #22c55e;';

      row.appendChild(avatar);
      row.appendChild(info);
      row.appendChild(status);
      section.appendChild(row);
    });

    if (agentsHeader) {
      var agentsContainer = agentsHeader.closest('div') || agentsHeader.parentElement;
      if (agentsContainer && agentsContainer.parentElement) {
        agentsContainer.parentElement.insertBefore(section, agentsContainer);
      }
    } else if (sidebar) {
      sidebar.appendChild(section);
    }
  }

  // ─── Run on DOM changes ────────────────────────────────────
  var debounceTimer = null;
  function onMutation() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      // Inject employees section BEFORE renaming so we can find "AGENTS" heading
      injectTeamSection();
      hideGoals();
      renameText(document.body);
      renameAttributes(document.body);
    }, 150);
  }

  function init() {
    // Inject team section BEFORE renaming (so we can still find "AGENTS" text)
    injectTeamSection();
    hideGoals();
    renameText(document.body);
    renameAttributes(document.body);
    var observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1000); });
  } else {
    setTimeout(init, 1000);
  }

  // Retry aggressively for first 10 seconds (React SPA takes time to render sidebar)
  var retryCount = 0;
  var retryInterval = setInterval(function () {
    retryCount++;
    if (retryCount > 20) { clearInterval(retryInterval); return; }
    if (!document.getElementById('sv-team-section')) {
      injectTeamSection();
    }
  }, 500);
})();
