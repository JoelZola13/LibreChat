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
    var homeDarkLogoIconSrc = '/assets/streetbot-icon-home-dark-animated.svg?v=20260423k';
    var homeLightLogoIconSrc = '/assets/streetbot-icon-home-light-animated.svg?v=20260423b';
    var homeDarkLogoTextSrc = '/assets/streetbot-text-home-dark-soft.svg?v=20260423k';
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
      'html[data-theme="dark"] #sv-home-nav-links a:hover, html.dark #sv-home-nav-links a:hover, html[data-theme="dark"] body .sv-home-nav-link:hover, html.dark body .sv-home-nav-link:hover, html[data-theme="dark"] body .sv-home-nav-link:focus-visible, html.dark body .sv-home-nav-link:focus-visible { background:#28292C !important; color:#E6E7F2 !important; box-shadow:none !important; }',
      '#sv-home-donate { position:absolute; right:110px; top:10px; display:inline-flex; align-items:center; padding:8px 18px; background:#FFD600; color:#000; font-size:14px; font-weight:700; font-family:Rubik,sans-serif; text-decoration:none; border-radius:25px; border:2px solid #FFD600; transition:opacity 0.15s; z-index:10; }',
      '#sv-home-donate:hover { opacity:0.9; }',
      // Hide the greeting text and default icon on home
      '#sv-home-landing-override { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; position:relative; top:-25px; }',
      '#sv-home-landing-override .sv-bot-icon { width:90px; height:auto; display:block; line-height:0; }',
      '#sv-home-landing-override .sv-bot-icon svg { display:block; width:100%; height:auto; overflow:visible; }',
      '#sv-home-landing-override .sv-bot-icon img { display:block; width:100%; height:auto; }',
      '#sv-home-landing-override .sv-bot-text { width:110px; height:auto; margin-top:1px; }',
      '.sv-home-live-logo { width:100%; height:100%; display:flex; align-items:center; justify-content:center; line-height:0; }',
      '.sv-home-live-logo svg { display:block; width:100%; height:100%; overflow:visible; }',
      '.sv-home-live-logo img { display:block; width:100%; height:100%; object-fit:contain; }',
      '#sv-home-landing-override .sv-bot-icon-dark, #sv-home-landing-override .sv-bot-text-dark { display:none; }',
      '#sv-home-landing-override .sv-bot-icon-light, #sv-home-landing-override .sv-bot-text-light { display:block; }',
      '#sv-home-landing-override[data-sv-effective-theme="dark"] .sv-bot-icon-dark, #sv-home-landing-override[data-sv-effective-theme="dark"] .sv-bot-text-dark { display:block !important; }',
      '#sv-home-landing-override[data-sv-effective-theme="dark"] .sv-bot-icon-light, #sv-home-landing-override[data-sv-effective-theme="dark"] .sv-bot-text-light { display:none !important; }',
      '#sv-home-landing-override[data-sv-effective-theme="light"] .sv-bot-icon-dark, #sv-home-landing-override[data-sv-effective-theme="light"] .sv-bot-text-dark { display:none !important; }',
      '#sv-home-landing-override[data-sv-effective-theme="light"] .sv-bot-icon-light, #sv-home-landing-override[data-sv-effective-theme="light"] .sv-bot-text-light { display:block !important; }',
      'html[data-theme="light"] #sv-home-composer { position:relative !important; overflow:hidden !important; isolation:isolate !important; border-radius:24px !important; background:linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(252,253,254,0.95) 100%) !important; background-color:rgba(255,255,255,0.93) !important; border:0.5px solid rgba(0,0,0,0.12) !important; box-shadow:0 14px 28px rgba(143,151,160,0.16), inset 0 1px 0 rgba(255,255,255,0.96) !important; backdrop-filter:blur(24px) saturate(118%) !important; -webkit-backdrop-filter:blur(24px) saturate(118%) !important; }',
      'html[data-theme="light"] #sv-home-composer::before { content:none !important; }',
      'html[data-theme="light"] #sv-home-composer::after { content:none !important; }',
      'html[data-theme="light"] #sv-home-composer textarea { color:rgba(71,79,89,0.96) !important; }',
      'html[data-theme="light"] #sv-home-composer textarea::placeholder { color:rgba(91,98,109,0.94) !important; }',
      'html[data-theme="light"] #sv-home-composer #send-button { display:flex !important; align-items:center !important; justify-content:center !important; width:36px !important; height:36px !important; min-width:36px !important; min-height:36px !important; padding:0 !important; border-radius:999px !important; appearance:none !important; -webkit-appearance:none !important; background:#FFD600 !important; background-image:none !important; border:0 !important; outline:none !important; color:rgba(47,55,63,0.96) !important; opacity:1 !important; box-shadow:none !important; filter:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }',
      'html[data-theme="light"] #sv-home-composer #send-button:disabled { appearance:none !important; -webkit-appearance:none !important; background:#FFD600 !important; background-image:none !important; border:0 !important; outline:none !important; color:rgba(47,55,63,0.96) !important; opacity:1 !important; box-shadow:none !important; filter:none !important; }',
      'html[data-theme="light"] #sv-home-composer #audio-recorder, html[data-theme="light"] #sv-home-composer #attach-file-menu-button, html[data-theme="light"] #sv-home-composer #attach-file { width:36px !important; height:36px !important; min-width:36px !important; min-height:36px !important; color:rgba(72,79,88,0.96) !important; transform:none !important; }',
      'html[data-theme="dark"] #sv-home-composer { position:relative !important; overflow:hidden !important; isolation:isolate !important; border-radius:24px !important; background:linear-gradient(114deg, rgba(30,33,40,0.38) 0%, rgba(30,33,40,0.38) 46%, rgba(30,33,40,0.38) 100%) !important; background-color:rgba(30,33,40,0.38) !important; border:0.5px solid rgba(255,255,255,0.12) !important; box-shadow:0 16px 34px rgba(1,4,8,0.10) !important; backdrop-filter:blur(28px) saturate(146%) !important; -webkit-backdrop-filter:blur(28px) saturate(146%) !important; }',
      'html[data-theme="dark"] #sv-home-composer::before { content:none !important; }',
      'html[data-theme="dark"] #sv-home-composer::after { content:none !important; }',
      'html[data-theme="dark"] #sv-home-composer > * { position:relative; z-index:1; }',
      'html[data-theme="dark"] #sv-home-composer textarea { color:rgba(236,240,242,0.90) !important; }',
      'html[data-theme="dark"] #sv-home-composer textarea::placeholder { color:rgba(188,195,201,0.94) !important; }',
      'html[data-theme="dark"] #sv-home-composer #send-button { display:flex !important; align-items:center !important; justify-content:center !important; width:36px !important; height:36px !important; min-width:36px !important; min-height:36px !important; padding:0 !important; border-radius:999px !important; background:linear-gradient(180deg, rgba(246,248,250,0.99) 0%, rgba(223,227,231,0.95) 100%) !important; border:1px solid rgba(255,255,255,0.72) !important; color:rgba(47,55,63,0.96) !important; opacity:1 !important; box-shadow:0 9px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.84) !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }',
      'html[data-theme="dark"] #sv-home-composer #send-button:disabled { background:linear-gradient(180deg, rgba(246,248,250,0.99) 0%, rgba(223,227,231,0.95) 100%) !important; border:1px solid rgba(255,255,255,0.72) !important; color:rgba(47,55,63,0.96) !important; opacity:1 !important; }',
      'html[data-theme="dark"] #sv-home-composer #audio-recorder, html[data-theme="dark"] #sv-home-composer #attach-file-menu-button, html[data-theme="dark"] #sv-home-composer #attach-file { width:36px !important; height:36px !important; min-width:36px !important; min-height:36px !important; color:rgba(230,234,238,0.90) !important; transform:none !important; }',
    ].join('\n');
    document.head.appendChild(style);

    function getEffectiveTheme() {
      try {
        var forcedTheme = new URL(window.location.href).searchParams.get('sv-force-theme');
        if (forcedTheme === 'light' || forcedTheme === 'dark') {
          return forcedTheme;
        }
      } catch (e) {}

      var html = document.documentElement;
      if (html.classList.contains('light')) {
        return 'light';
      }
      if (html.classList.contains('dark')) {
        return 'dark';
      }
      var sidebarHeader = document.getElementById('sv-sidebar-header');
      if (sidebarHeader) {
        var sidebarHeaderBg = window.getComputedStyle(sidebarHeader).backgroundColor || '';
        if (sidebarHeaderBg === 'rgb(17, 17, 19)' || sidebarHeaderBg === 'rgba(17, 17, 19, 1)') {
          return 'dark';
        }
        if (sidebarHeaderBg === 'rgb(245, 246, 248)' || sidebarHeaderBg === 'rgba(245, 246, 248, 1)') {
          return 'light';
        }
      }
      var attrTheme = html.getAttribute('data-theme');
      if (attrTheme === 'light' || attrTheme === 'dark') {
        return attrTheme;
      }

      try {
        var storedTheme = window.localStorage && (localStorage.getItem('theme') || localStorage.getItem('color-theme'));
        if (storedTheme === 'light' || storedTheme === 'dark') {
          return storedTheme;
        }
      } catch (e) {}

      var sidebar = document.querySelector('nav#chat-history-nav');
      if (sidebar) {
        var sidebarBg = window.getComputedStyle(sidebar).backgroundColor || '';
        if (sidebarBg === 'rgb(17, 17, 19)' || sidebarBg === 'rgba(17, 17, 19, 1)') {
          return 'dark';
        }
        if (sidebarBg === 'rgb(245, 246, 248)' || sidebarBg === 'rgba(245, 246, 248, 1)') {
          return 'light';
        }
      }

      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function syncLandingTheme() {
      var landing = document.getElementById('sv-home-landing-override');
      if (!landing) {
        return;
      }

      var theme = getEffectiveTheme();
      var darkIcon = landing.querySelector('.sv-bot-icon-dark');
      var lightIcon = landing.querySelector('.sv-bot-icon-light');
      var darkText = landing.querySelector('.sv-bot-text-dark');
      var lightText = landing.querySelector('.sv-bot-text-light');

      landing.setAttribute('data-sv-effective-theme', theme);

      if (darkIcon) {
        darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
      }
      if (lightIcon) {
        lightIcon.style.display = theme === 'dark' ? 'none' : 'block';
      }
      if (darkText) {
        darkText.style.display = theme === 'dark' ? 'block' : 'none';
      }
      if (lightText) {
        lightText.style.display = theme === 'dark' ? 'none' : 'block';
      }
    }

    function parseInlineSvg(svgText) {
      var sanitized = String(svgText || '').replace(/<script[\s\S]*?<\/script>/gi, '');
      var parsed = new window.DOMParser().parseFromString(sanitized, 'image/svg+xml');
      var svg = parsed && parsed.documentElement;
      if (!svg || String(svg.nodeName).toLowerCase() !== 'svg') {
        return null;
      }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('data-sv-inline-logo', 'true');
      return document.importNode(svg, true);
    }

    function bindEyeTracking(svg) {
      if (!svg || svg.getAttribute('data-sv-eye-bound') === 'true' || typeof svg.createSVGPoint !== 'function') {
        return;
      }

      var eyes = Array.prototype.slice.call(svg.querySelectorAll('.eye-track'));
      if (!eyes.length) {
        return;
      }

      if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) {
        return;
      }

      function readNumber(node, name, fallback) {
        var value = parseFloat(node.getAttribute(name));
        return isNaN(value) ? fallback : value;
      }

      var point = svg.createSVGPoint();
      var frameId = null;
      var resetTimer = null;
      var state = eyes.map(function (eye) {
        return {
          node: eye,
          centerX: readNumber(eye, 'data-eye-x', 0),
          centerY: readNumber(eye, 'data-eye-y', 0),
          maxX: readNumber(eye, 'data-eye-max-x', 4.5),
          maxY: readNumber(eye, 'data-eye-max-y', 3.2),
          currentX: 0,
          currentY: 0,
          targetX: 0,
          targetY: 0,
        };
      });

      function render() {
        var shouldContinue = false;
        state.forEach(function (eye) {
          eye.currentX += (eye.targetX - eye.currentX) * 0.18;
          eye.currentY += (eye.targetY - eye.currentY) * 0.18;

          if (Math.abs(eye.targetX - eye.currentX) > 0.01 || Math.abs(eye.targetY - eye.currentY) > 0.01) {
            shouldContinue = true;
          }

          eye.node.setAttribute(
            'transform',
            'translate(' + eye.currentX.toFixed(2) + ' ' + eye.currentY.toFixed(2) + ')'
          );
        });

        frameId = shouldContinue ? window.requestAnimationFrame(render) : null;
      }

      function queueRender() {
        if (frameId === null) {
          frameId = window.requestAnimationFrame(render);
        }
      }

      function resetEyes() {
        state.forEach(function (eye) {
          eye.targetX = 0;
          eye.targetY = 0;
        });
        queueRender();
      }

      function scheduleReset() {
        if (resetTimer !== null) {
          window.clearTimeout(resetTimer);
        }
        resetTimer = window.setTimeout(function () {
          resetTimer = null;
          resetEyes();
        }, 140);
      }

      function updateTargets(clientX, clientY) {
        var ctm = svg.getScreenCTM();
        if (!ctm) {
          return;
        }

        point.x = clientX;
        point.y = clientY;
        var local = point.matrixTransform(ctm.inverse());

        state.forEach(function (eye) {
          var dx = local.x - eye.centerX;
          var dy = local.y - eye.centerY;
          var angle = Math.atan2(dy, dx);
          var strength = Math.min(1, Math.hypot(dx, dy) / 120);
          eye.targetX = Math.cos(angle) * eye.maxX * strength;
          eye.targetY = Math.sin(angle) * eye.maxY * strength;
        });

        queueRender();
      }

      function handlePointerMove(event) {
        if (event.pointerType === 'touch') {
          return;
        }
        if (resetTimer !== null) {
          window.clearTimeout(resetTimer);
          resetTimer = null;
        }
        updateTargets(event.clientX, event.clientY);
      }

      function handlePointerOut(event) {
        if (!event.relatedTarget) {
          scheduleReset();
        }
      }

      document.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerout', handlePointerOut, { passive: true });
      window.addEventListener('blur', resetEyes);
      svg.setAttribute('data-sv-eye-bound', 'true');
    }

    function hydrateAnimatedLogo(selector, src) {
      var wrapper = document.querySelector(selector);
      if (!wrapper || wrapper.getAttribute('data-sv-logo-src') === src || wrapper.getAttribute('data-sv-logo-loading') === 'true') {
        return;
      }

      wrapper.setAttribute('data-sv-logo-loading', 'true');
      window.fetch(src, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Failed to load logo ' + src);
          }
          return response.text();
        })
        .then(function (svgText) {
          if (!wrapper.isConnected) {
            return;
          }
          var svg = parseInlineSvg(svgText);
          if (!svg) {
            throw new Error('Invalid SVG for ' + src);
          }
          wrapper.innerHTML = '';
          wrapper.appendChild(svg);
          bindEyeTracking(svg);
          wrapper.setAttribute('data-sv-logo-src', src);
        })
        .catch(function (error) {
          console.warn('[sv-home-logo]', error);
        })
        .finally(function () {
          if (wrapper.isConnected) {
            wrapper.removeAttribute('data-sv-logo-loading');
          }
        });
    }

    function replaceLanding() {
      if (document.getElementById('sv-home-landing-override')) return;
      // Find the greeting container — it has the bot icon + "Happy late night, Joel"
      var landingContent = document.querySelector('.flex.flex-col.items-center.gap-0.p-2');
      if (!landingContent) return;

      var override = document.createElement('div');
      override.id = 'sv-home-landing-override';
      override.innerHTML =
        '<div class="sv-bot-icon sv-bot-icon-dark" role="img" aria-label="Street Bot"></div>' +
        '<div class="sv-bot-icon sv-bot-icon-light" role="img" aria-label="Street Bot"></div>' +
        '<img class="sv-bot-text sv-bot-text-dark" src="' + homeDarkLogoTextSrc + '" alt="Street Bot">' +
        '<img class="sv-bot-text sv-bot-text-light" src="/assets/streetbot-text-light.svg" alt="Street Bot">';

      landingContent.innerHTML = '';
      landingContent.appendChild(override);
      hydrateAnimatedLogo('#sv-home-landing-override .sv-bot-icon-dark', homeDarkLogoIconSrc);
      hydrateAnimatedLogo('#sv-home-landing-override .sv-bot-icon-light', homeLightLogoIconSrc);
      syncLandingTheme();
    }

    function syncVisibleLandingIcon() {
      var iconHost = document.querySelector('.flex.flex-col.items-center.gap-0.p-2 .relative.size-10.justify-center');
      if (!iconHost) {
        return;
      }

      var wrapper = iconHost.querySelector('.sv-home-live-logo');
      if (!wrapper) {
        iconHost.innerHTML = '<div class="sv-home-live-logo" role="img" aria-label="Street Bot"></div>';
        wrapper = iconHost.querySelector('.sv-home-live-logo');
      }

      if (!wrapper) {
        return;
      }

      var theme = getEffectiveTheme();
      iconHost.setAttribute('data-sv-effective-theme', theme);
      hydrateAnimatedLogo('.sv-home-live-logo', theme === 'dark' ? homeDarkLogoIconSrc : homeLightLogoIconSrc);
    }

    function styleComposer() {
      var composer = document.querySelector(
        'form div.relative.flex.w-full.flex-grow.flex-col.overflow-hidden.rounded-t-3xl.border',
      );
      if (!composer) return;
      composer.id = 'sv-home-composer';
    }

    var attempts = 0;
    var pollId = setInterval(function () {
      replaceLanding();
      syncVisibleLandingIcon();
      hydrateAnimatedLogo('#sv-home-landing-override .sv-bot-icon-dark', homeDarkLogoIconSrc);
      hydrateAnimatedLogo('#sv-home-landing-override .sv-bot-icon-light', homeLightLogoIconSrc);
      syncLandingTheme();
      styleComposer();
      attempts++;
      if (
        (document.getElementById('sv-home-landing-override') &&
          document.querySelector('#sv-home-landing-override .sv-bot-icon-dark[data-sv-logo-src]') &&
          document.querySelector('#sv-home-landing-override .sv-bot-icon-light svg[data-sv-inline-logo="true"]') &&
          document.getElementById('sv-home-composer')) ||
        attempts > 50
      ) {
        clearInterval(pollId);
      }
    }, 200);

    var themeObserver = new MutationObserver(function () {
      syncLandingTheme();
      syncVisibleLandingIcon();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    document.addEventListener('visibilitychange', syncLandingTheme, { passive: true });
    window.addEventListener('focus', syncLandingTheme, { passive: true });
    document.addEventListener('visibilitychange', syncVisibleLandingIcon, { passive: true });
    window.addEventListener('focus', syncVisibleLandingIcon, { passive: true });
  }

  // ── /c/new: hide theme toggle + profile avatar ──
  if (path === '/c/new') {
    var newChatDarkLogoIconSrc = '/assets/streetbot-icon-home-dark-animated.svg?v=20260423k';
    var s = document.createElement('style');
    s.textContent = [
      'button[aria-label="Toggle theme"] { display:none !important; }',
      'a[aria-label="Settings"] { display:none !important; }',
      'html[data-theme="dark"] .sv-new-chat-landing-logo { width:100%; height:100%; display:flex; align-items:center; justify-content:center; line-height:0; }',
      'html[data-theme="dark"] .sv-new-chat-landing-logo svg { display:block; width:100%; height:100%; overflow:visible; }',
      'html[data-theme="light"] #sv-home-composer, html[data-theme="light"] form div.relative.flex.w-full.flex-grow.flex-col.overflow-hidden.rounded-t-3xl.border { border:0.5px solid rgba(0,0,0,0.12) !important; }',
      'html[data-theme="dark"] #sv-home-composer, html[data-theme="dark"] form div.relative.flex.w-full.flex-grow.flex-col.overflow-hidden.rounded-t-3xl.border { background:linear-gradient(114deg, rgba(30,33,40,0.38) 0%, rgba(30,33,40,0.38) 46%, rgba(30,33,40,0.38) 100%) !important; background-color:rgba(30,33,40,0.38) !important; border:0.5px solid rgba(255,255,255,0.12) !important; box-shadow:0 16px 34px rgba(1,4,8,0.10) !important; }',
    ].join('\n');
    document.head.appendChild(s);

    function getNewChatTheme() {
      var html = document.documentElement;
      if (html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark') {
        return 'dark';
      }
      if (html.classList.contains('light') || html.getAttribute('data-theme') === 'light') {
        return 'light';
      }
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function parseNewChatSvg(svgText) {
      var sanitized = String(svgText || '').replace(/<script[\s\S]*?<\/script>/gi, '');
      var parsed = new window.DOMParser().parseFromString(sanitized, 'image/svg+xml');
      var svg = parsed && parsed.documentElement;
      if (!svg || String(svg.nodeName).toLowerCase() !== 'svg') {
        return null;
      }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('data-sv-inline-logo', 'true');
      return document.importNode(svg, true);
    }

    function bindNewChatEyeTracking(svg) {
      if (!svg || svg.getAttribute('data-sv-eye-bound') === 'true' || typeof svg.createSVGPoint !== 'function') {
        return;
      }

      var eyes = Array.prototype.slice.call(svg.querySelectorAll('.eye-track'));
      if (!eyes.length || (window.matchMedia && !window.matchMedia('(pointer: fine)').matches)) {
        return;
      }

      function readNumber(node, name, fallback) {
        var value = parseFloat(node.getAttribute(name));
        return isNaN(value) ? fallback : value;
      }

      var point = svg.createSVGPoint();
      var frameId = null;
      var resetTimer = null;
      var state = eyes.map(function (eye) {
        return {
          node: eye,
          centerX: readNumber(eye, 'data-eye-x', 0),
          centerY: readNumber(eye, 'data-eye-y', 0),
          maxX: readNumber(eye, 'data-eye-max-x', 4.5),
          maxY: readNumber(eye, 'data-eye-max-y', 3.2),
          currentX: 0,
          currentY: 0,
          targetX: 0,
          targetY: 0,
        };
      });

      function render() {
        var shouldContinue = false;
        state.forEach(function (eye) {
          eye.currentX += (eye.targetX - eye.currentX) * 0.18;
          eye.currentY += (eye.targetY - eye.currentY) * 0.18;
          if (Math.abs(eye.targetX - eye.currentX) > 0.01 || Math.abs(eye.targetY - eye.currentY) > 0.01) {
            shouldContinue = true;
          }
          eye.node.setAttribute('transform', 'translate(' + eye.currentX.toFixed(2) + ' ' + eye.currentY.toFixed(2) + ')');
        });
        frameId = shouldContinue ? window.requestAnimationFrame(render) : null;
      }

      function queueRender() {
        if (frameId === null) {
          frameId = window.requestAnimationFrame(render);
        }
      }

      function resetEyes() {
        state.forEach(function (eye) {
          eye.targetX = 0;
          eye.targetY = 0;
        });
        queueRender();
      }

      function updateTargets(clientX, clientY) {
        var ctm = svg.getScreenCTM();
        if (!ctm) {
          return;
        }

        point.x = clientX;
        point.y = clientY;
        var local = point.matrixTransform(ctm.inverse());
        state.forEach(function (eye) {
          var dx = local.x - eye.centerX;
          var dy = local.y - eye.centerY;
          var angle = Math.atan2(dy, dx);
          var strength = Math.min(1, Math.hypot(dx, dy) / 120);
          eye.targetX = Math.cos(angle) * eye.maxX * strength;
          eye.targetY = Math.sin(angle) * eye.maxY * strength;
        });
        queueRender();
      }

      document.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') {
          return;
        }
        if (resetTimer !== null) {
          window.clearTimeout(resetTimer);
          resetTimer = null;
        }
        updateTargets(event.clientX, event.clientY);
      }, { passive: true });
      document.addEventListener('pointerout', function (event) {
        if (!event.relatedTarget) {
          if (resetTimer !== null) {
            window.clearTimeout(resetTimer);
          }
          resetTimer = window.setTimeout(resetEyes, 140);
        }
      }, { passive: true });
      window.addEventListener('blur', resetEyes);
      svg.setAttribute('data-sv-eye-bound', 'true');
    }

    function hydrateNewChatLogo(wrapper) {
      if (!wrapper || wrapper.getAttribute('data-sv-logo-src') === newChatDarkLogoIconSrc || wrapper.getAttribute('data-sv-logo-loading') === 'true') {
        return;
      }

      wrapper.setAttribute('data-sv-logo-loading', 'true');
      window.fetch(newChatDarkLogoIconSrc, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Failed to load logo ' + newChatDarkLogoIconSrc);
          }
          return response.text();
        })
        .then(function (svgText) {
          if (!wrapper.isConnected) {
            return;
          }
          var svg = parseNewChatSvg(svgText);
          if (!svg) {
            throw new Error('Invalid SVG for ' + newChatDarkLogoIconSrc);
          }
          wrapper.innerHTML = '';
          wrapper.appendChild(svg);
          bindNewChatEyeTracking(svg);
          wrapper.setAttribute('data-sv-logo-src', newChatDarkLogoIconSrc);
        })
        .catch(function (error) {
          console.warn('[sv-new-chat-logo]', error);
        })
        .finally(function () {
          if (wrapper.isConnected) {
            wrapper.removeAttribute('data-sv-logo-loading');
          }
        });
    }

    function syncNewChatLandingLogo() {
      var iconHost = document.querySelector('.flex.flex-col.items-center.gap-0.p-2 .relative.size-10.justify-center');
      if (!iconHost) {
        return false;
      }

      if (getNewChatTheme() !== 'dark') {
        if (iconHost.getAttribute('data-sv-new-chat-logo') === 'true') {
          iconHost.innerHTML = iconHost.getAttribute('data-sv-original-html') || '';
          iconHost.removeAttribute('data-sv-new-chat-logo');
          iconHost.removeAttribute('data-sv-original-html');
        }
        return true;
      }

      if (iconHost.getAttribute('data-sv-new-chat-logo') !== 'true') {
        iconHost.setAttribute('data-sv-original-html', iconHost.innerHTML);
        iconHost.setAttribute('data-sv-new-chat-logo', 'true');
        iconHost.innerHTML = '<div class="sv-new-chat-landing-logo" role="img" aria-label="Street Bot"></div>';
      }

      hydrateNewChatLogo(iconHost.querySelector('.sv-new-chat-landing-logo'));
      return true;
    }

    var newChatLogoAttempts = 0;
    var newChatLogoPoll = window.setInterval(function () {
      var found = syncNewChatLandingLogo();
      newChatLogoAttempts++;
      if ((found && document.querySelector('.sv-new-chat-landing-logo svg[data-sv-inline-logo="true"]')) || newChatLogoAttempts > 50) {
        window.clearInterval(newChatLogoPoll);
      }
    }, 200);

    var newChatThemeObserver = new MutationObserver(syncNewChatLandingLogo);
    newChatThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    window.addEventListener('focus', syncNewChatLandingLogo, { passive: true });
    document.addEventListener('visibilitychange', syncNewChatLandingLogo, { passive: true });
  }
})();
