/**
 * Street Voices — Platform Loader
 * Single entry point that loads all SV platform scripts.
 * Used by LobeHub and SV Social (injected via analytics slot / layout).
 * LibreChat loads scripts directly from custom-index.html.
 */
(function () {
  'use strict';

  // ── LobeHub route lockdown ──
  // Only /discover and /discover/assistant/* pages are allowed.
  var path = window.location.pathname;
  var search = window.location.search;
  if (path === '/' || path === '/chat' || path === '/settings' || path === '/market' ||
      path === '/discover' || path === '/discover/' || path === '/discover/home' ||
      path.startsWith('/discover/plugins') ||
      path.startsWith('/discover/models') || path.startsWith('/discover/providers')) {
    window.location.replace('/discover/assistant');
  }
  // Redirect LobeHub category URLs back to main assistant page (we filter client-side)
  if (search.includes('category=') && (path === '/assistant' || path === '/discover/assistant')) {
    window.location.replace('/discover/assistant');
  }

  var BASE = 'http://localhost:18790/shared/';
  var VERSIONS = { 'unified-nav.js': 84, 'mission-control.js': 5, 'marketplace.js': 1 };
  var scripts = ['unified-nav.js', 'mission-control.js', 'marketplace.js'];

  scripts.forEach(function (name) {
    if (document.querySelector('script[src*="' + name + '"]')) return;
    var s = document.createElement('script');
    s.src = BASE + name + '?v=' + (VERSIONS[name] || 1);
    s.defer = true;
    document.head.appendChild(s);
  });

  // ══════════════════════════════════════════════════════════════════
  // PERMANENT LOBEHUB LOCKDOWN CSS
  // This stylesheet is NEVER removed. It hides:
  //   - Changelog modals
  //   - Left icon sidebar (aside)
  //   - Non-assistant discover tabs (plugins, models, providers, home)
  //   - "Create" button
  //   - "..." more menu
  //   - Marketplace banner/title leftovers
  // ══════════════════════════════════════════════════════════════════
  var lockCSS = document.createElement('style');
  lockCSS.id = 'sv-lobehub-lockdown';
  lockCSS.textContent = [
    // ── Changelog modal suppression ──
    'body > div[role="dialog"] { display: none !important; }',
    '.ant-modal-root:has(.ant-modal-body) { display: none !important; }',
    '.ant-modal-mask { display: none !important; }',
    '[class*="changelogModal"] { display: none !important; }',
    '[class*="ChangelogModal"] { display: none !important; }',

    // ── Left ICON sidebar (58px wide div, NOT the categories aside which is 220px) ──
    // Do NOT hide aside — that's the categories sidebar (All, Copywriting, General, etc.)
    'nav[class*="sider"] { display: none !important; }',
    'div[class*="layoutSider"] { display: none !important; }',
    // LobeHub icon sidebar is a div.layoutkit-flexbox with these hashed classes
    '.css-17k0fp9 { display: none !important; }',
    '.acss-h3zh61 { display: none !important; }',

    // ── Discover tabs — hide everything except "Assistant" ──
    'a[href="/discover"] { display: none !important; }',
    'a[href="/discover/plugins"] { display: none !important; }',
    'a[href="/discover/models"] { display: none !important; }',
    'a[href="/discover/providers"] { display: none !important; }',
    'a[href="/discover/assistant/create"] { display: none !important; }',

    // ── "Create" button (top right) ──
    'a[href*="/create"] { display: none !important; }',

    // ── "Recently Published" sort row — hide the entire bar ──
    '[class*="SortFilter"] { display: none !important; }',
    '[class*="sortFilter"] { display: none !important; }',
    '[class*="toolbar"] { display: none !important; }',

    // ── LobeHub header bar — keep visible but hide internal elements ──
    // (LobeHub/Discover text and search are hidden via DOM, replaced with "Agent Market")

    // ── Marketplace banner/title leftovers ──
    '.sv-mkt-banner { display: none !important; }',
    '.sv-agents-title { display: none !important; }',

    // ── GitHub source icon on agent cards ──
    'a[href*="github.com"] svg, a[aria-label*="github" i], a[href*="github.com"] { display: none !important; }',
    // GitHub icon may also appear as standalone SVG with the GitHub path
    'svg[class*="github" i], [class*="github" i] { display: none !important; }',

    // ── Token usage badge (chain icon + "-- --") on agent cards ──
    '.ant-tag { display: none !important; }',
    // Target any small rounded element containing SVG + dashes inside agent card links
    'a[href*="streetvoices-"] [class*="acss-"][class*="ewgp7w"] { display: none !important; }',
    'a[href*="streetvoices-"] [class*="acss-"][class*="75zej6"] { display: none !important; }',

    // ── Pull agent cards up to close gap below header ──
    // The tab row is hidden but still takes space; compensate with negative margin
    '.css-cvghq + div, .acss-56udz3 + div { margin-top: -12px !important; }',

    // ── Pull categories sidebar up to align with agent cards ──
    'aside { position: relative !important; top: -40px !important; margin-bottom: -40px !important; }',
  ].join('\n');
  (document.head || document.documentElement).appendChild(lockCSS);

  // ══════════════════════════════════════════════════════════════════
  // DOM-BASED LOCKDOWN — catches things CSS can't (text-based hiding)
  // ══════════════════════════════════════════════════════════════════
  function lockdownDOM() {
    // Hide tabs/links by their visible text
    var killTexts = ['Home', 'MCP Plugin', 'Model', 'Model Provider', 'Create'];
    document.querySelectorAll('a, button, [role="tab"]').forEach(function (el) {
      var text = (el.textContent || '').trim();
      for (var i = 0; i < killTexts.length; i++) {
        if (text === killTexts[i]) {
          el.style.display = 'none';
          break;
        }
      }
    });

    // Hide the "..." more menu (typically a button with just an ellipsis icon or 3 dots)
    document.querySelectorAll('button, [role="button"]').forEach(function (el) {
      var text = (el.textContent || '').trim();
      // LobeHub "more" button — contains only an SVG icon, very small
      if (text === '' || text === '...' || text === '···' || text === '⋯') {
        // Check if it's in the discover header area (near the tabs)
        var rect = el.getBoundingClientRect();
        if (rect.top < 150 && rect.top > 40) {
          el.style.display = 'none';
        }
      }
    });

    // Hide the plugins tab — LobeHub may render it as a span/div with a paperclip SVG
    // Look for tab-like elements near the top that aren't "Assistant"
    document.querySelectorAll('[role="tab"], [class*="tab"], [class*="Tab"]').forEach(function (el) {
      var text = (el.textContent || '').trim();
      if (text !== 'Assistant' && text !== 'All' && text !== '' && !text.includes('Featured') && !text.includes('Recently')) {
        var rect = el.getBoundingClientRect();
        // Only hide if it's in the header tab row (top 150px, below our nav at 40px)
        if (rect.top < 150 && rect.top > 40) {
          // Don't hide search or sort controls
          if (text !== 'Search' && !el.querySelector('input')) {
            el.style.display = 'none';
          }
        }
      }
    });

    // Replace the LobeHub header bar text with "Agent Market"
    document.querySelectorAll('div').forEach(function (el) {
      var text = (el.textContent || '').trim();
      if (text.includes('LobeHub')) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 500 && rect.height < 80 && rect.height > 30 && rect.top < 100) {
          // Don't hide — replace the content instead
          // Find the LobeHub logo/text and Discover text inside
          // Hide ALL children except our injected title
          for (var i = 0; i < el.children.length; i++) {
            var ch = el.children[i];
            if (!ch.classList.contains('sv-header-title')) {
              ch.style.display = 'none';
            }
          }
          // Inject "Agent Market" title if not already there
          if (!el.querySelector('.sv-header-title')) {
            var title = document.createElement('div');
            title.className = 'sv-header-title';
            title.style.cssText = 'font-family: "Space Grotesk", -apple-system, sans-serif; font-size: 20px; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; gap: 10px; padding-left: 16px;';
            title.innerHTML = '<span style="color: #D4AF37;">Agent</span> Market';
            el.prepend(title);
          }
        }
      }
    });

    // Pull categories sidebar up to align with agent cards
    document.querySelectorAll('aside').forEach(function (el) {
      el.style.position = 'relative';
      el.style.top = '-40px';
      el.style.marginBottom = '-40px';
    });

    // Replace LobeHub's default categories with our real agent team categories
    // Agent slug → team mapping (client-side filtering)
    var AGENT_TEAMS = {
      'streetvoices-ceo': 'executive', 'streetvoices-security-compliance': 'executive', 'streetvoices-executive-memory': 'executive',
      'streetvoices-auto': 'executive',
      'streetvoices-communication-manager': 'communication', 'streetvoices-email-agent': 'communication',
      'streetvoices-slack-agent': 'communication', 'streetvoices-whatsapp-agent': 'communication',
      'streetvoices-calendar-agent': 'communication', 'streetvoices-communication-memory': 'communication',
      'streetvoices-content-manager': 'content', 'streetvoices-article-researcher': 'content',
      'streetvoices-article-writer': 'content', 'streetvoices-social-media-manager': 'content',
      'streetvoices-content-memory': 'content',
      'streetvoices-development-manager': 'development', 'streetvoices-backend-developer': 'development',
      'streetvoices-frontend-developer': 'development', 'streetvoices-database-manager': 'development',
      'streetvoices-devops': 'development', 'streetvoices-development-memory': 'development',
      'streetvoices-finance-manager': 'finance', 'streetvoices-accounting-agent': 'finance',
      'streetvoices-crypto-agent': 'finance', 'streetvoices-finance-memory': 'finance',
      'streetvoices-grant-manager': 'grant_writing', 'streetvoices-grant-writer': 'grant_writing',
      'streetvoices-budget-manager': 'grant_writing', 'streetvoices-project-manager': 'grant_writing',
      'streetvoices-grant-memory': 'grant_writing',
      'streetvoices-research-manager': 'research', 'streetvoices-media-platform-researcher': 'research',
      'streetvoices-media-program-researcher': 'research', 'streetvoices-street-bot-researcher': 'research',
      'streetvoices-research-memory': 'research',
      'streetvoices-scraping-manager': 'scraping', 'streetvoices-scraping-agent': 'scraping',
      'streetvoices-scraper-memory': 'scraping',
    };
    var SV_CATEGORIES = [
      { label: 'All',                      value: '', icon: '📋' },
      { label: 'Executive & Leadership',    value: 'executive', icon: '👔' },
      { label: 'Communication',             value: 'communication', icon: '📡' },
      { label: 'Content & Media',           value: 'content', icon: '✍️' },
      { label: 'Development',               value: 'development', icon: '💻' },
      { label: 'Finance',                   value: 'finance', icon: '💰' },
      { label: 'Grant Writing',             value: 'grant_writing', icon: '📝' },
      { label: 'Research',                  value: 'research', icon: '🔬' },
      { label: 'Data & Scraping',           value: 'scraping', icon: '🕷️' },
    ];

    // Client-side filter function
    window.__svActiveFilter = window.__svActiveFilter || '';
    function svFilterAgents(teamValue) {
      window.__svActiveFilter = teamValue;
      // Find all agent card wrappers (parent divs of the <a> links)
      document.querySelectorAll('a[href*="streetvoices-"]').forEach(function (link) {
        var href = link.getAttribute('href') || '';
        var slug = href.split('/').pop();
        var agentTeam = AGENT_TEAMS[slug] || '';
        // Walk up to the card wrapper (div.layoutkit-flexbox ~365x246)
        var card = link;
        for (var i = 0; i < 6; i++) {
          if (!card.parentElement) break;
          card = card.parentElement;
          var rect = card.getBoundingClientRect();
          if (rect.width > 250 && rect.height > 100) break;
        }
        if (teamValue === '' || agentTeam === teamValue) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
      // Update sidebar active state
      document.querySelectorAll('.sv-cat-item').forEach(function (item) {
        if (item.dataset.team === teamValue) {
          item.style.background = 'rgba(0,0,0,0.06)';
          item.style.fontWeight = '600';
        } else {
          item.style.background = '';
          item.style.fontWeight = '';
        }
      });
    }

    // Build the sidebar menu
    var asideMenu = document.querySelector('aside ul.ant-menu');
    if (asideMenu && !asideMenu.dataset.svReplaced) {
      asideMenu.dataset.svReplaced = '1';
      asideMenu.innerHTML = '';
      SV_CATEGORIES.forEach(function (cat) {
        var li = document.createElement('li');
        li.className = 'ant-menu-item sv-cat-item';
        li.dataset.team = cat.value;
        li.style.cssText = 'display:flex;align-items:center;padding:8px 16px;cursor:pointer;border-radius:8px;margin-bottom:2px;';
        if (window.__svActiveFilter === cat.value) {
          li.style.background = 'rgba(0,0,0,0.06)';
          li.style.fontWeight = '600';
        }
        li.innerHTML = '<span style="margin-right:10px;font-size:16px;">' + cat.icon + '</span>' +
                       '<span style="font-size:14px;">' + cat.label + '</span>';
        li.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          svFilterAgents(cat.value);
        });
        asideMenu.appendChild(li);
      });
    }
    // Re-apply active filter (in case MutationObserver re-ran lockdown)
    if (window.__svActiveFilter) {
      svFilterAgents(window.__svActiveFilter);
    }

    // Pull the agent grid up 25px — find the scrollable content area below the header
    document.querySelectorAll('div').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      // The main content area: wide, starts around y=90-140, contains agent cards
      if (rect.width > 500 && rect.top > 60 && rect.top < 150 && rect.height > 300) {
        if (el.querySelector('a[href*="streetvoices-"]')) {
          el.style.marginTop = '-12px';
        }
      }
    });

    // Hide the narrow left icon sidebar (layoutkit-flexbox div, ~58px wide, on far left)
    document.querySelectorAll('div').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      // Narrow column on the far left, tall (sidebar-like)
      if (rect.width > 30 && rect.width < 80 && rect.height > 300 && rect.left < 5) {
        var cs = window.getComputedStyle(el);
        if (cs.display === 'flex' || cs.display === 'inline-flex') {
          el.style.display = 'none';
        }
      }
    });

    // Hide the "Recently Published" / sort row
    // Walk through elements near the top looking for the sort dropdown bar
    document.querySelectorAll('div, span, button').forEach(function (el) {
      var text = (el.textContent || '').trim();
      if (text === 'Recently Published' || text === 'Featured Plugins' || text === 'Most Popular') {
        // Walk up to find the row container (the bar that holds the dropdown)
        var row = el;
        var maxWalk = 6;
        while (row && maxWalk-- > 0) {
          var rect = row.getBoundingClientRect();
          // The sort bar spans the full width and is thin (< 60px tall)
          if (rect.width > 400 && rect.height < 60 && rect.height > 0) {
            row.style.display = 'none';
            break;
          }
          row = row.parentElement;
        }
      }
    });

    // Push "Published on" footer text right to make room for + Add button
    // Find the dashed-border footer rows inside agent cards and add left padding
    document.querySelectorAll('a[href*="streetvoices-"]').forEach(function (link) {
      // The footer is the last child div with a dashed border-top
      var children = link.children;
      for (var i = children.length - 1; i >= 0; i--) {
        var child = children[i];
        var cs = window.getComputedStyle(child);
        if (cs.borderTopStyle === 'dashed') {
          child.style.paddingLeft = '90px';
          break;
        }
      }
    });

    // Hide token usage badges (chain icon + "-- --") on agent cards
    // Remove debug textarea if it exists
    var dbg = document.getElementById('sv-debug-dump');
    if (dbg) dbg.remove();

    // Nuke leftover banner/title elements
    document.querySelectorAll('.sv-mkt-banner, .sv-agents-title').forEach(function (el) { el.remove(); });

    // Hide token usage badges (chain icon + "-- --") on agent cards
    // These are small elements inside card links containing an SVG and dash text
    document.querySelectorAll('a[href*="streetvoices-"]').forEach(function (link) {
      // Find all elements inside the card that have an SVG and short text with dashes
      link.querySelectorAll('*').forEach(function (el) {
        var text = (el.textContent || '').trim();
        // Match elements with "-- --", "--", "- -" patterns (token placeholders)
        if (/^[-–—\s]+$/.test(text) && el.querySelector('svg')) {
          el.style.display = 'none';
        }
        // Also match elements that are just the badge wrapper (small, has border-radius, contains SVG)
        if (el.querySelector('svg') && !el.querySelector('h2') && !el.querySelector('h3') &&
            !el.querySelector('img') && !el.classList.contains('sv-price-badge')) {
          var rect = el.getBoundingClientRect();
          if (rect.width > 30 && rect.width < 160 && rect.height > 15 && rect.height < 45) {
            // Small element with SVG — likely the token badge
            var innerText = el.textContent.replace(/\s/g, '');
            if (innerText === '--' || innerText === '----' || innerText === '-' || innerText === '') {
              el.style.display = 'none';
            }
          }
        }
      });
    });
  }

  // Run lockdown as soon as DOM is interactive and keep running it
  function startLockdown() {
    lockdownDOM();
    // MutationObserver to continuously enforce
    var lockObserver = new MutationObserver(function () {
      clearTimeout(lockObserver._t);
      lockObserver._t = setTimeout(lockdownDOM, 150);
    });
    lockObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.body) {
    startLockdown();
  } else {
    document.addEventListener('DOMContentLoaded', startLockdown);
  }

  // ══════════════════════════════════════════════════════════════════
  // CHANGELOG MODAL SUPPRESSION (MutationObserver + route blocking)
  // ══════════════════════════════════════════════════════════════════
  function isChangelogElement(el) {
    if (!el || !el.textContent) return false;
    var text = el.textContent;
    return (text.includes('Welcome back') && text.includes('new features')) ||
           (text.includes('Major Updates') && text.includes('changelog'));
  }

  function nukeChangelog() {
    document.querySelectorAll('[role="dialog"]').forEach(function (el) {
      if (isChangelogElement(el)) {
        el.remove();
        document.querySelectorAll('[class*="mask"], [class*="Mask"], [data-sentinel], [class*="backdrop"]').forEach(function (m) { m.remove(); });
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    });
    document.querySelectorAll('.ant-modal-root, .ant-modal-wrap').forEach(function (el) {
      if (isChangelogElement(el)) {
        el.remove();
        document.querySelectorAll('.ant-modal-mask').forEach(function (m) { m.remove(); });
        document.body.style.overflow = '';
      }
    });
    document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"]').forEach(function (el) {
      if (isChangelogElement(el)) {
        var target = el;
        while (target.parentElement && target.parentElement !== document.body) {
          target = target.parentElement;
        }
        if (target !== document.body && target !== document.documentElement) {
          target.remove();
        } else {
          el.remove();
        }
        document.body.style.overflow = '';
      }
    });
  }

  nukeChangelog();

  var changelogObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.getAttribute && (node.getAttribute('role') === 'dialog' ||
            (node.className && (node.className.includes('modal') || node.className.includes('Modal'))))) {
          setTimeout(nukeChangelog, 50);
          setTimeout(nukeChangelog, 200);
          return;
        }
        if (node.querySelector && node.querySelector('[role="dialog"]')) {
          setTimeout(nukeChangelog, 50);
          setTimeout(nukeChangelog, 200);
          return;
        }
      }
    }
  });
  changelogObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Safety net — periodic changelog check
  var attempts = 0;
  var safetyInterval = setInterval(function () {
    attempts++;
    nukeChangelog();
    if (window.location.pathname.includes('/changelog')) {
      history.replaceState(null, '', '/discover');
    }
    if (attempts > 120) clearInterval(safetyInterval);
  }, 500);

  // Route interception — block changelog and non-allowed routes
  ['pushState', 'replaceState'].forEach(function (method) {
    var orig = history[method];
    history[method] = function () {
      var url = arguments[2];
      if (url && typeof url === 'string') {
        if (url.includes('/changelog')) return;
        if (url === '/chat' || url === '/settings' || url === '/' ||
            url === '/discover' || url === '/discover/' || url === '/discover/home' ||
            url.startsWith('/discover/plugins') || url.startsWith('/discover/models') ||
            url.startsWith('/discover/providers')) {
          arguments[2] = '/discover/assistant';
        }
      }
      return orig.apply(this, arguments);
    };
  });

  window.addEventListener('popstate', function () {
    var p = window.location.pathname;
    if (p.includes('/changelog') || p === '/chat' || p === '/settings' ||
        p === '/discover' || p === '/discover/' || p === '/discover/home' ||
        p.startsWith('/discover/plugins') || p.startsWith('/discover/models') ||
        p.startsWith('/discover/providers')) {
      history.replaceState(null, '', '/discover/assistant');
    }
  });
})();
