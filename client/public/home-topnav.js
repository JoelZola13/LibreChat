/**
 * home-topnav.js — Per-route UI tweaks for /home and /c/new.
 */
(function () {
  'use strict';
  var isHome = window.location.pathname === '/home' || window.__SV_HOME;
  var path = window.location.pathname;

  // If we were /home but got redirected to /c/new, push URL back
  if (window.__SV_HOME && path !== '/home') {
    history.replaceState(null, '', '/home');
    path = '/home';
  }

  // ── /home: block redirect, hide Auto Router + Temporary Chat, add nav text ──
  if (isHome) {
    var origReplace = history.replaceState.bind(history);
    history.replaceState = function () {
      if (arguments[2] === '/c/new' && window.location.pathname === '/home') {
        return;
      }
      return origReplace.apply(this, arguments);
    };

    var style = document.createElement('style');
    style.textContent = [
      'button[aria-label="Select a model"] { display:none !important; }',
      '.relative.flex.w-full.max-w-md { display:none !important; }',
      'button[aria-label="Temporary Chat"] { display:none !important; }',
      'button[aria-label="Temporary chat"] { display:none !important; }',
      '#sv-home-nav-links { position:absolute; left:50%; top:0; transform:translateX(-50%); display:flex; align-items:center; height:60px; gap:4px; z-index:10; }',
      '#sv-home-nav-links a { display:flex; align-items:center; padding:8px 12px; color:#8e8ea0; font-size:14px; font-family:Rubik,sans-serif; text-decoration:none; border-radius:8px; transition:color 0.15s, background 0.15s; }',
      '#sv-home-nav-links a:hover { color:#e3e3e8; background:rgba(255,255,255,0.05); }',
      '#sv-home-donate { position:absolute; right:110px; top:10px; display:inline-flex; align-items:center; padding:8px 18px; background:#FFD600; color:#000; font-size:14px; font-weight:700; font-family:Rubik,sans-serif; text-decoration:none; border-radius:25px; border:2px solid #FFD600; transition:opacity 0.15s; z-index:10; }',
      '#sv-home-donate:hover { opacity:0.9; }',
      // Hide the greeting text and default icon on home
      '#sv-home-landing-override { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; position:relative; top:-25px; }',
      '#sv-home-landing-override img { width:90px; height:auto; }',
      '#sv-home-landing-override .sv-bot-text { width:140px; height:auto; margin-top:8px; }',
      '@keyframes sv-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }',
      '#sv-home-landing-override .sv-bot-icon { animation: sv-float 3s ease-in-out infinite; }',
    ].join('\n');
    document.head.appendChild(style);

    function injectNavText() {
      if (document.getElementById('sv-home-nav-links')) return;
      // Find the main content panel (right side, next to sidebar)
      var mainEl = document.querySelector('main');
      if (!mainEl || !mainEl.parentElement) return;
      var mainPanel = mainEl.parentElement;
      mainPanel.style.position = 'relative';

      var nav = document.createElement('nav');
      nav.id = 'sv-home-nav-links';
      nav.innerHTML = [
        '<a href="/gallery">Street Gallery</a>',
        '<a href="/jobs">Job Board</a>',
        '<a href="/learning">Academy</a>',
        '<a href="/directory">Directory</a>',
        '<a href="/news">News</a>',
        '<a href="/about">About Us</a>',
      ].join('');

      mainPanel.appendChild(nav);

      if (!document.getElementById('sv-home-donate')) {
        var donate = document.createElement('a');
        donate.id = 'sv-home-donate';
        donate.href = '/donate';
        donate.textContent = 'Donate';
        mainPanel.appendChild(donate);
      }
    }

    function replaceLanding() {
      if (document.getElementById('sv-home-landing-override')) return;
      // Find the greeting container — it has the bot icon + "Happy late night, Joel"
      var landingContent = document.querySelector('.flex.flex-col.items-center.gap-0.p-2');
      if (!landingContent) return;

      var override = document.createElement('div');
      override.id = 'sv-home-landing-override';
      override.innerHTML =
        '<img class="sv-bot-icon hidden dark:block" src="/assets/streetbot-icon.svg" alt="Street Bot">' +
        '<img class="sv-bot-icon block dark:hidden" src="/assets/streetbot-icon-light.svg" alt="Street Bot">' +
        '<img class="sv-bot-text hidden dark:block" src="/assets/streetbot-text.svg" alt="Street Bot">' +
        '<img class="sv-bot-text block dark:hidden" src="/assets/streetbot-text-light.svg" alt="Street Bot">';

      landingContent.innerHTML = '';
      landingContent.appendChild(override);
    }

    var attempts = 0;
    var pollId = setInterval(function () {
      injectNavText();
      replaceLanding();
      attempts++;
      if (document.getElementById('sv-home-nav-links') && document.getElementById('sv-home-landing-override') || attempts > 50) {
        clearInterval(pollId);
      }
    }, 200);
  }

  // ── /c/new: hide theme toggle + profile avatar ──
  if (path === '/c/new') {
    var s = document.createElement('style');
    s.textContent = [
      'button[aria-label="Toggle theme"] { display:none !important; }',
      'a[aria-label="Settings"] { display:none !important; }',
    ].join('\n');
    document.head.appendChild(s);
  }
})();
