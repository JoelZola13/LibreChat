/**
 * Street Voices Instagram Template Editor — injected into LibreChat sidebar.
 * Adds a sidebar button that opens a full-page editor panel.
 */
(function () {
  'use strict';

  const BUTTON_ID = 'sv-template-btn';
  const PANEL_ID = 'sv-template-panel';

  // ─── Styles ────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sv-tpl-styles')) return;
    const style = document.createElement('style');
    style.id = 'sv-tpl-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;800&display=swap');

      @font-face {
        font-family: 'Cocogoose Compressed';
        src: local('Cocogoose Compressed'), local('CocogooseCompressed-Regular');
        font-weight: normal;
        font-style: normal;
      }

      #${PANEL_ID} {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        width: 100dvw;
        height: 100vh;
        height: 100dvh;
        z-index: 2147483646;
        background: #111;
        color: #e8e8ed;
        font-family: 'Rubik', sans-serif;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        isolation: isolate;
        animation: svSlideIn .2s ease-out;
      }
      body.sv-template-open {
        overflow: hidden !important;
      }
      @keyframes svSlideIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #${PANEL_ID} .sv-topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(17,17,17,0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid #222;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
      }
      #${PANEL_ID} .sv-topbar-title {
        color: #FFD600;
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
      }
      #${PANEL_ID} .sv-close {
        background: #1c1c22;
        border: 1px solid #2a2a33;
        border-radius: 8px;
        color: #8888a0;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 14px;
        cursor: pointer;
        transition: all .15s;
        font-family: 'Rubik', sans-serif;
      }
      #${PANEL_ID} .sv-close:hover {
        border-color: #555;
        color: #e8e8ed;
      }
      #${PANEL_ID} .sv-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 30px;
        padding: 30px 20px 60px;
      }
      /* ===== SLIDES ===== */
      #${PANEL_ID} .sv-slides {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
      }
      #${PANEL_ID} .sv-slide-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      #${PANEL_ID} .sv-slide-label {
        color: #666;
        font-size: 11px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 500;
      }
      #${PANEL_ID} .sv-slide-wrapper {
        width: calc(1080px * 0.5);
        height: calc(1350px * 0.5);
        flex-shrink: 0;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      #${PANEL_ID} .sv-slide {
        width: 1080px;
        height: 1350px;
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
        transform: scale(0.5);
        transform-origin: top left;
      }
      /* Front page */
      #${PANEL_ID} .sv-front { background: #fff; }
      #${PANEL_ID} .sv-front .bg-image {
        position: absolute; top: -662px; left: -1347px;
        width: 3600px; height: 2400px;
        max-width: none !important;
      }
      #${PANEL_ID} .sv-front .blur-overlay {
        position: absolute; left: 0; top: 817px; width: 1080px; height: 533px;
        background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 20%, rgba(0,0,0,0.5) 50%, #000 100%);
        backdrop-filter: blur(9.15px); -webkit-backdrop-filter: blur(9.15px);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 35%);
        mask-image: linear-gradient(to bottom, transparent 0%, black 35%);
      }
      #${PANEL_ID} .sv-front .article-badge {
        position: absolute; left: 100px; top: 0; width: 62px; height: 379px; overflow: visible;
      }
      #${PANEL_ID} .sv-front .article-badge-bg {
        width: 62px; height: 379px; background: rgba(255, 214, 0, 0.99);
        border-radius: 0 0 36px 36px; position: absolute; top: 0;
      }
      #${PANEL_ID} .sv-front .article-badge-text {
        position: absolute; left: 100px; top: 210px; width: 62px; height: 128px;
        display: flex; align-items: center; justify-content: center;
      }
      #${PANEL_ID} .sv-front .article-badge-text span {
        display: inline-block;
        transform: rotate(90deg);
        font-family: 'Rubik', sans-serif; font-weight: 800;
        font-size: 27px; letter-spacing: 1.35px; text-transform: uppercase; color: #000;
        white-space: nowrap;
      }
      #${PANEL_ID} .sv-front .cta-pill {
        position: absolute; left: 100px; top: 1181px;
        width: 514px; height: 50px; background: #ffd600; border-radius: 36px;
      }
      #${PANEL_ID} .sv-front .cta-text {
        position: absolute; left: 120px; top: 1175px; width: 648px;
        font-family: 'Rubik', sans-serif; font-weight: 500;
        font-size: 26px; line-height: 62px; letter-spacing: 0.52px; color: #000;
      }
      #${PANEL_ID} .sv-front .headline {
        position: absolute; left: 100px; top: 877px; width: 793px;
        font-family: 'Cocogoose Compressed', 'Impact', 'Arial Black', sans-serif;
        font-weight: normal; font-style: normal; font-size: 69px; line-height: 69px;
        letter-spacing: -0.69px; text-transform: uppercase; color: #fff;
      }
      /* Article page */
      #${PANEL_ID} .sv-article { background: #fff; }
      #${PANEL_ID} .sv-article .article-body {
        position: absolute; left: 123px; top: 240px; width: 834px;
        font-family: 'Rubik', sans-serif; font-weight: 400;
        font-size: 27px; line-height: 44px; letter-spacing: 0.54px;
        color: #000; text-align: center;
      }
      #${PANEL_ID} .sv-article .article-body p { margin: 0; }
      #${PANEL_ID} .sv-article .article-body .spacer { height: 44px; }
      #${PANEL_ID} .sv-article .cta-pill {
        position: absolute; left: 280px; top: 1187px;
        width: 514px; height: 50px; background: #ffd600; border-radius: 36px;
      }
      #${PANEL_ID} .sv-article .cta-text {
        position: absolute; left: 50%; transform: translateX(-50%);
        top: 1181px; width: 480px; font-family: 'Rubik', sans-serif;
        font-weight: 500; font-size: 26px; line-height: 62px;
        letter-spacing: 0.52px; color: #000; text-align: center;
      }
      /* Editor panel */
      #${PANEL_ID} .sv-editor {
        background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
        padding: 32px; width: 100%; max-width: 1160px;
      }
      #${PANEL_ID} .sv-editor h2 {
        color: #FFD600; font-size: 13px; font-weight: 800;
        letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px;
      }
      #${PANEL_ID} .sv-editor-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
      }
      #${PANEL_ID} .sv-field { display: flex; flex-direction: column; gap: 6px; }
      #${PANEL_ID} .sv-field.full-width { grid-column: 1 / -1; }
      #${PANEL_ID} .sv-field label {
        color: #888; font-size: 11px; letter-spacing: 0.1em;
        text-transform: uppercase; font-weight: 500;
      }
      #${PANEL_ID} .sv-field input,
      #${PANEL_ID} .sv-field textarea {
        background: #222; border: 1px solid #444; border-radius: 8px;
        color: #fff; font-family: 'Rubik', sans-serif; font-size: 14px;
        padding: 12px 14px; outline: none; transition: border-color 0.2s;
      }
      #${PANEL_ID} .sv-field input:focus,
      #${PANEL_ID} .sv-field textarea:focus { border-color: #FFD600; }
      #${PANEL_ID} .sv-field textarea { min-height: 160px; resize: vertical; line-height: 1.6; }
      #${PANEL_ID} .sv-field input[type="file"] { padding: 10px; cursor: pointer; }
      #${PANEL_ID} .sv-field input[type="file"]::file-selector-button {
        background: #FFD600; color: #000; border: none; border-radius: 6px;
        padding: 6px 14px; font-family: 'Rubik', sans-serif; font-weight: 600;
        font-size: 12px; cursor: pointer; margin-right: 12px;
      }
      #${PANEL_ID} .sv-btn-export {
        grid-column: 1 / -1; background: #FFD600; color: #000; border: none;
        border-radius: 10px; padding: 14px 32px; font-family: 'Rubik', sans-serif;
        font-weight: 800; font-size: 14px; letter-spacing: 0.1em;
        text-transform: uppercase; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
        margin-top: 8px;
      }
      #${PANEL_ID} .sv-btn-export:hover {
        transform: translateY(-2px); box-shadow: 0 6px 24px rgba(255, 214, 0, 0.3);
      }
      #${PANEL_ID} .sv-btn-export:active { transform: translateY(0); }
      #${PANEL_ID} .sv-download-row {
        display: flex; gap: 12px; margin-top: 16px; grid-column: 1 / -1; justify-content: center;
      }
      #${PANEL_ID} .sv-btn-dl {
        background: transparent; color: #FFD600; border: 1px solid #FFD600;
        border-radius: 8px; padding: 10px 24px; font-family: 'Rubik', sans-serif;
        font-weight: 600; font-size: 12px; letter-spacing: 0.05em;
        text-transform: uppercase; cursor: pointer; transition: all 0.2s; text-decoration: none;
        display: inline-block;
      }
      #${PANEL_ID} .sv-btn-dl:hover { background: #FFD600; color: #000; }
      /* Draggable */
      #${PANEL_ID} .draggable { cursor: grab; }
      #${PANEL_ID} .draggable:hover { outline: 2px dashed rgba(255, 214, 0, 0.6); outline-offset: 4px; }
      #${PANEL_ID} .draggable.dragging { cursor: grabbing; outline: 2px solid #FFD600; outline-offset: 4px; }
      #${PANEL_ID} .drag-coords {
        position: absolute; top: -28px; left: 0;
        background: rgba(0,0,0,0.8); color: #FFD600;
        font-family: 'Rubik', monospace; font-size: 16px;
        padding: 2px 8px; border-radius: 4px; pointer-events: none;
        white-space: nowrap; opacity: 0; transition: opacity 0.15s; z-index: 999;
      }
      #${PANEL_ID} .draggable:hover .drag-coords,
      #${PANEL_ID} .draggable.dragging .drag-coords { opacity: 1; }

      /* Export-only cleanup to prevent editor chrome from leaking into PNG */
      #${PANEL_ID} .sv-slide.sv-export-clean,
      #${PANEL_ID} .sv-slide.sv-export-clean * {
        caret-color: transparent !important;
      }
      #${PANEL_ID} .sv-slide.sv-export-clean *,
      #${PANEL_ID} .sv-slide.sv-export-clean *::before,
      #${PANEL_ID} .sv-slide.sv-export-clean *::after {
        animation: none !important;
        transition: none !important;
        border: 0 !important;
        border-width: 0 !important;
        border-style: none !important;
        border-image: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      #${PANEL_ID} .sv-slide.sv-export-clean .drag-coords {
        display: none !important;
        opacity: 0 !important;
      }
      #${PANEL_ID} .sv-slide.sv-export-clean .draggable,
      #${PANEL_ID} .sv-slide.sv-export-clean .draggable:hover,
      #${PANEL_ID} .sv-slide.sv-export-clean .draggable.dragging,
      #${PANEL_ID} .sv-slide.sv-export-clean .draggable-selected {
        outline: none !important;
        outline-offset: 0 !important;
        box-shadow: none !important;
        cursor: default !important;
      }
      #${PANEL_ID} .sv-slide.sv-export-clean .headline,
      #${PANEL_ID} .sv-slide.sv-export-clean .article-body,
      #${PANEL_ID} .sv-slide.sv-export-clean .cta-pill,
      #${PANEL_ID} .sv-slide.sv-export-clean .cta-text {
        outline: none !important;
        box-shadow: none !important;
      }

      /* Sidebar button */
      #${BUTTON_ID} {
        position: relative; display: flex; width: 100%; cursor: pointer;
        align-items: center; justify-content: space-between;
        border-radius: 0.5rem; padding: 0.5rem 0.75rem;
        font-size: 0.875rem; line-height: 1.25rem; outline: none;
        color: var(--text-primary);
      }
      #${BUTTON_ID}:hover { background: var(--surface-active-alt, rgba(255,255,255,0.06)); }
      #${BUTTON_ID}:focus-visible { outline: 2px solid; outline-offset: -2px; }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel ─────────────────────────────────────────────────
  const DEFAULT_HEADLINE = 'The Artistic Evolution of Derin Falana: Reflection, Growth, and Toronto\'s Musical Renaissance';
  const DEFAULT_CTA = 'Go visit streetvoices.ca to read more';
  const DEFAULT_BODY = 'For fans of Toronto\'s vibrant music scene, one lingering question recently has been, \u201cWhere has Derin Falana been?\u201d Once an emerging voice creating significant buzz, Falana stepped back unexpectedly, leaving fans curious about his quiet absence. Now, after an introspective hiatus, he\u2019s ready to share what he\u2019s been up to\u2014and how this break reshaped his artistry.\n\nThe Hiatus: A Creative Reset\nFans wondering what prompted Falana\u2019s hiatus got their answers when he opened up about the pivotal experiences that shaped his recent journey.\n\nStreet Voices: Were there any particular experiences during your break that deeply influenced your new music?\n\nDerin Falana: \u201cI did a two-month stint in LA that shifted my perspectives in both life and art. I got to meet and work with people I\'m inspired by. I got to live a little more. Then I took my findings to the drawing board and it led to a creative breakthrough.\u201d';

  function showPanel() {
    if (document.getElementById(PANEL_ID)) return;
    injectStyles();
    document.body.classList.add('sv-template-open');

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="sv-topbar">
        <span class="sv-topbar-title">Street Voices \u2014 Instagram Template</span>
        <button class="sv-close" id="sv-close-btn">\u2190 Back to chat</button>
      </div>
      <div class="sv-body">
        <div class="sv-slides">
          <div class="sv-slide-col">
            <span class="sv-slide-label">Slide 1 \u2014 Cover</span>
            <div class="sv-slide-wrapper"><div class="sv-slide sv-front" id="svFrontPage">
              <img class="bg-image" id="svBgImage" src="/sv-instagram-bg.jpg" alt="Background">
              <div class="blur-overlay"></div>
              <div class="article-badge"><div class="article-badge-bg"></div></div>
              <div class="article-badge-text"><span>Article</span></div>
              <div class="headline draggable" id="svHeadline"><span class="drag-coords" id="svCoordsHL">100, 877</span>${esc(DEFAULT_HEADLINE)}</div>
              <div class="cta-pill"></div>
              <div class="cta-text" id="svCta1">${esc(DEFAULT_CTA)}</div>
            </div></div>
          </div>
          <div class="sv-slide-col">
            <span class="sv-slide-label">Slide 2 \u2014 Article</span>
            <div class="sv-slide-wrapper"><div class="sv-slide sv-article" id="svArticlePage">
              <div class="article-body draggable" id="svArticleBody"><span class="drag-coords" id="svCoordsBody">123, 240</span>${bodyToHtml(DEFAULT_BODY)}</div>
              <div class="cta-pill"></div>
              <div class="cta-text" id="svCta2">${esc(DEFAULT_CTA)}</div>
            </div></div>
          </div>
        </div>
        <div class="sv-editor">
          <h2>Customize Template</h2>
          <div class="sv-editor-grid">
            <div class="sv-field">
              <label>Headline</label>
              <input type="text" id="svInputHL" value="${escAttr(DEFAULT_HEADLINE)}">
            </div>
            <div class="sv-field">
              <label>CTA Text</label>
              <input type="text" id="svInputCta" value="${escAttr(DEFAULT_CTA)}">
            </div>
            <div class="sv-field full-width">
              <label>Article Body</label>
              <textarea id="svInputBody">${esc(DEFAULT_BODY)}</textarea>
            </div>
            <div class="sv-field">
              <label>Background Image</label>
              <input type="file" id="svInputImage" accept="image/*">
            </div>
            <div class="sv-field">
              <label>Background Image URL</label>
              <input type="text" id="svInputImageUrl" placeholder="https://images.unsplash.com/...">
            </div>
            <button class="sv-btn-export" id="svBtnExport">Export as PNG</button>
            <div class="sv-download-row" id="svDownloadRow" style="display:none">
              <a class="sv-btn-dl" id="svDlFront" download="sv-cover.png">Download Cover</a>
              <a class="sv-btn-dl" id="svDlArticle" download="sv-article.png">Download Article</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Wire up events
    document.getElementById('sv-close-btn').onclick = closePanel;
    document.getElementById('svInputHL').oninput = updateHL;
    document.getElementById('svInputCta').oninput = updateCta;
    document.getElementById('svInputBody').oninput = updateBody;
    document.getElementById('svInputImage').onchange = function(e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function(ev) { document.getElementById('svBgImage').src = ev.target.result; };
      r.readAsDataURL(f);
    };
    document.getElementById('svInputImageUrl').oninput = function() {
      var url = this.value.trim();
      if (url) document.getElementById('svBgImage').src = url;
    };
    document.getElementById('svBtnExport').onclick = exportSlides;

    // Esc to close
    panel._keyHandler = function (e) { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', panel._keyHandler);

    // Init drag-to-move after a tick so elements are in DOM and sized
    requestAnimationFrame(function() {
      var hl = document.getElementById('svHeadline');
      var maxBottom = hl.offsetTop + hl.offsetHeight;
      initDraggable(hl, 'svCoordsHL', { maxBottomY: maxBottom });
      initDraggable(document.getElementById('svArticleBody'), 'svCoordsBody');
    });
  }

  function closePanel() {
    if (exportInProgress) return;
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      document.body.classList.remove('sv-template-open');
      return;
    }
    if (panel._keyHandler) document.removeEventListener('keydown', panel._keyHandler);
    panel.remove();
    document.body.classList.remove('sv-template-open');
  }

  // ─── Helpers ───────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escAttr(s) {
    return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function bodyToHtml(raw) {
    return raw.split('\n\n').map(function(block) {
      if (!block.trim()) return '<div class="spacer"></div>';
      return '<p>' + esc(block).replace(/\n/g, '<br>') + '</p>';
    }).join('<div class="spacer"></div>');
  }

  // ─── Editor logic ──────────────────────────────────────────
  function updateHL() {
    var el = document.getElementById('svHeadline');
    var coordsSpan = document.getElementById('svCoordsHL');
    el.innerHTML = '';
    el.appendChild(coordsSpan);
    el.appendChild(document.createTextNode(document.getElementById('svInputHL').value));
  }

  function updateCta() {
    var val = document.getElementById('svInputCta').value;
    document.getElementById('svCta1').textContent = val;
    document.getElementById('svCta2').textContent = val;
  }

  function updateBody() {
    var raw = document.getElementById('svInputBody').value;
    var el = document.getElementById('svArticleBody');
    var coordsSpan = document.getElementById('svCoordsBody');
    el.innerHTML = '';
    el.appendChild(coordsSpan);
    // Build body HTML
    var frag = document.createDocumentFragment();
    raw.split('\n\n').forEach(function(block, i) {
      if (i > 0) {
        var sp = document.createElement('div');
        sp.className = 'spacer';
        frag.appendChild(sp);
      }
      if (!block.trim()) {
        var sp2 = document.createElement('div');
        sp2.className = 'spacer';
        frag.appendChild(sp2);
      } else {
        var p = document.createElement('p');
        p.innerHTML = esc(block).replace(/\n/g, '<br>');
        frag.appendChild(p);
      }
    });
    el.appendChild(frag);
  }

  // ─── Drag-to-move ─────────────────────────────────────────
  var SCALE = 0.5;
  var exportInProgress = false;

  function initDraggable(el, coordsId, opts) {
    opts = opts || {};
    el.addEventListener('mousedown', function(e) {
      if (e.target.classList.contains('drag-coords')) return;
      e.preventDefault();
      var isDragging = true;
      el.classList.add('dragging');
      var startX = e.clientX, startY = e.clientY;
      var startLeft = parseInt(el.style.left) || parseInt(getComputedStyle(el).left);
      var startTop = parseInt(el.style.top) || parseInt(getComputedStyle(el).top);

      function onMove(e) {
        if (!isDragging) return;
        var dx = (e.clientX - startX) / SCALE;
        var dy = (e.clientY - startY) / SCALE;
        var newLeft = Math.round(startLeft + dx);
        var newTop = Math.round(startTop + dy);
        if (opts.maxBottomY != null) {
          var h = el.offsetHeight;
          if (newTop + h > opts.maxBottomY) newTop = opts.maxBottomY - h;
        }
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        if (coordsId) document.getElementById(coordsId).textContent = newLeft + ', ' + newTop;
      }
      function onUp() {
        isDragging = false;
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ─── Export (fidelity-first with safe fallback) ───
  function exportSlides() {
    if (exportInProgress) return;
    doExport();
  }

  function loadScriptOnce(src) {
    return new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[data-sv-lib="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function() { resolve(); }, { once: true });
        existing.addEventListener('error', function() { reject(new Error('Failed to load ' + src)); }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.svLib = src;
      script.onload = function() {
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = function() {
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return null;
    var commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return null;
    var header = dataUrl.slice(0, commaIndex);
    var payload = dataUrl.slice(commaIndex + 1);

    var mimeMatch = header.match(/^data:([^;]+)/);
    var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    var isBase64 = /;base64/i.test(header);

    try {
      var byteString;
      if (isBase64) byteString = atob(payload);
      else byteString = decodeURIComponent(payload);

      var bytes = new Uint8Array(byteString.length);
      for (var i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    } catch (_) {
      return null;
    }
  }

  function triggerBrowserDownload(dataUrl, fileName) {
    var blob = dataUrlToBlob(dataUrl);
    if (!blob) return false;

    var blobUrl = URL.createObjectURL(blob);
    var tempLink = document.createElement('a');
    tempLink.href = blobUrl;
    tempLink.download = fileName;
    tempLink.rel = 'noopener';
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();

    setTimeout(function() {
      URL.revokeObjectURL(blobUrl);
    }, 10000);

    return true;
  }

  function wireDownloadLinkHandlers() {
    var frontLink = document.getElementById('svDlFront');
    var articleLink = document.getElementById('svDlArticle');
    if (frontLink && !frontLink.dataset.boundClick) {
      frontLink.dataset.boundClick = '1';
      frontLink.addEventListener('click', function(e) {
        var dataUrl = frontLink.dataset.pngDataUrl || frontLink.getAttribute('href') || '';
        if (dataUrl.indexOf('data:image/png') !== 0) return;
        if (triggerBrowserDownload(dataUrl, 'sv-cover.png')) {
          e.preventDefault();
          return;
        }
        // Keep browser-native anchor behavior for fallback. Do not call click()
        // here or we can recurse into this same handler and no-op.
        frontLink.setAttribute('href', dataUrl);
        frontLink.setAttribute('download', 'sv-cover.png');
      });
    }
    if (articleLink && !articleLink.dataset.boundClick) {
      articleLink.dataset.boundClick = '1';
      articleLink.addEventListener('click', function(e) {
        var dataUrl = articleLink.dataset.pngDataUrl || articleLink.getAttribute('href') || '';
        if (dataUrl.indexOf('data:image/png') !== 0) return;
        if (triggerBrowserDownload(dataUrl, 'sv-article.png')) {
          e.preventDefault();
          return;
        }
        articleLink.setAttribute('href', dataUrl);
        articleLink.setAttribute('download', 'sv-article.png');
      });
    }
  }

  // Build a blurred+gradient image to replace backdrop-filter (html2canvas can't render it)
  async function createBlurFallback(slide) {
    var overlay = slide.querySelector('.blur-overlay');
    if (!overlay) return null;
    var bgImg = slide.querySelector('.bg-image');
    if (!bgImg) return null;

    var img = new Image();
    img.crossOrigin = 'anonymous';
    try {
      await new Promise(function(res, rej) {
        img.onload = res;
        img.onerror = function() { rej(new Error('CORS image load failed')); };
        img.src = bgImg.src;
      });
    } catch(e) {
      // CORS blocked — try without crossOrigin (canvas will be tainted but blur fallback is cosmetic)
      console.warn('Blur fallback: CORS load failed, trying without crossOrigin...');
      img = new Image();
      try {
        await new Promise(function(res, rej) {
          img.onload = res;
          img.onerror = function() { rej(new Error('Image load failed entirely')); };
          img.src = bgImg.src;
        });
      } catch(e2) {
        console.warn('Blur fallback: image load failed entirely, skipping blur');
        return null;
      }
    }

    // object-fit: cover math
    var cW = 1080, cH = 1350, iW = img.naturalWidth, iH = img.naturalHeight;
    var s = Math.max(cW / iW, cH / iH);
    var dW = iW * s, dH = iH * s, oX = (cW - dW) / 2, oY = (cH - dH) / 2;

    // Draw blurred region with padding to avoid hard edges (overlay sits at top:817, height:533)
    var blurPad = 40; // extra padding so blur bleeds naturally at edges
    var c = document.createElement('canvas'); c.width = 1080; c.height = 533 + blurPad * 2;
    var ctx = c.getContext('2d');
    ctx.filter = 'blur(10px)';
    ctx.drawImage(img, oX, oY - 817 + blurPad, dW, dH);
    ctx.filter = 'none';

    // Dark gradient on top (shifted by blurPad)
    var g = ctx.createLinearGradient(0, blurPad, 0, 533 + blurPad);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.15, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.3, 'rgba(0,0,0,0.25)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.50)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.80)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 533 + blurPad * 2);

    // Mask: very gradual transparent top -> opaque (smoother than CSS mask)
    var mc = document.createElement('canvas'); mc.width = 1080; mc.height = 533;
    var mx = mc.getContext('2d');
    mx.drawImage(c, 0, -blurPad); // shift back so we crop the padded canvas to 533px
    mx.globalCompositeOperation = 'destination-in';
    var mg = mx.createLinearGradient(0, 0, 0, 533);
    mg.addColorStop(0, 'rgba(0,0,0,0)');
    mg.addColorStop(0.08, 'rgba(0,0,0,0.05)');
    mg.addColorStop(0.18, 'rgba(0,0,0,0.25)');
    mg.addColorStop(0.35, 'rgba(0,0,0,0.85)');
    mg.addColorStop(0.5, 'rgba(0,0,0,1)');
    mg.addColorStop(1, 'rgba(0,0,0,1)');
    mx.fillStyle = mg; mx.fillRect(0, 0, 1080, 533);

    var fbImg = document.createElement('img');
    fbImg.src = mc.toDataURL('image/png');
    fbImg.style.cssText = 'position:absolute;left:0;top:817px;width:1080px;height:533px;pointer-events:none;';
    fbImg.className = 'blur-fb';
    overlay.parentElement.insertBefore(fbImg, overlay);
    overlay.style.display = 'none';
    return { fb: fbImg, ov: overlay };
  }

  // Simple in-place render — temporarily expand slide to full size, capture, restore
  async function renderSlide(slide) {
    var wrapper = slide.parentElement;
    // Use setProperty with !important to reliably override the CSS transform rule
    slide.style.setProperty('transform', 'scale(1)', 'important');
    wrapper.style.width = '1080px';
    wrapper.style.height = '1350px';
    wrapper.style.overflow = 'visible';
    wrapper.style.boxShadow = 'none';
    var blurInfo = await createBlurFallback(slide);
    slide.querySelectorAll('.drag-coords').forEach(function(el) { el.style.display = 'none'; });
    slide.querySelectorAll('.draggable').forEach(function(el) { el.style.outline = 'none'; });

    // Fix: html2canvas doesn't enforce overflow:hidden on the root capture element.
    // Instead of trying to fix individual elements, we crop the canvas after capture
    // to exact slide dimensions, removing any overflow content.
    slide.style.overflow = 'hidden';

    try {
      var canvas = await html2canvas(slide, {
        width: 1080, height: 1350,
        scale: 2,
        useCORS: true, allowTaint: true,
        backgroundColor: null, logging: false
      });
      // Crop canvas to exact slide dimensions to remove any overflow
      var targetW = 1080 * 2;
      var targetH = 1350 * 2;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        var cropped = document.createElement('canvas');
        cropped.width = targetW;
        cropped.height = targetH;
        var ctx = cropped.getContext('2d');
        // Overflow extends above/left, so actual slide content is at the bottom-right
        var sx = Math.max(0, canvas.width - targetW);
        var sy = Math.max(0, canvas.height - targetH);
        ctx.drawImage(canvas, sx, sy, targetW, targetH, 0, 0, targetW, targetH);
        return cropped.toDataURL('image/png');
      }
      return canvas.toDataURL('image/png');
    } finally {
      slide.style.overflow = '';
      slide.style.removeProperty('transform');
      wrapper.style.width = '';
      wrapper.style.height = '';
      wrapper.style.overflow = '';
      wrapper.style.boxShadow = '';
      slide.querySelectorAll('.drag-coords').forEach(function(el) { el.style.display = ''; });
      slide.querySelectorAll('.draggable').forEach(function(el) { el.style.outline = ''; });
      if (blurInfo) { blurInfo.fb.remove(); blurInfo.ov.style.display = ''; }
    }
  }

  async function doExport() {
    if (exportInProgress) return;
    exportInProgress = true;
    var btn = document.getElementById('svBtnExport');
    btn.textContent = 'Rendering\u2026';
    btn.disabled = true;
    try {
      // Wait for fonts before rendering
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      // Load html2canvas if needed (local copy avoids CDN/service-worker issues)
      if (typeof html2canvas === 'undefined') {
        await loadScriptOnce('/html2canvas.min.js');
      }
      var frontUrl = await renderSlide(document.getElementById('svFrontPage'));
      var articleUrl = await renderSlide(document.getElementById('svArticlePage'));
      var dlFront = document.getElementById('svDlFront');
      var dlArticle = document.getElementById('svDlArticle');
      dlFront.href = frontUrl;
      dlFront.dataset.pngDataUrl = frontUrl;
      dlArticle.href = articleUrl;
      dlArticle.dataset.pngDataUrl = articleUrl;
      wireDownloadLinkHandlers();
      document.getElementById('svDownloadRow').style.display = 'flex';
    } catch(e) {
      console.error('Export error:', e);
      var msg = e instanceof Error ? e.message : (e && e.type ? 'Event: ' + e.type : String(e));
      alert('Export failed: ' + msg);
    }
    btn.textContent = 'Export as PNG';
    btn.disabled = false;
    exportInProgress = false;
  }

  // ─── Sidebar injection ────────────────────────────────────
  var TEMPLATE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';

  function createButton() {
    var btn = document.createElement('div');
    btn.id = BUTTON_ID;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Instagram Template');
    btn.innerHTML =
      '<div style="display:flex;flex:1;align-items:center;overflow:hidden;padding-right:1.5rem">' +
        '<div style="margin-right:0.5rem;width:1.25rem;height:1.25rem;flex-shrink:0">' + TEMPLATE_SVG + '</div>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">IG Template</span>' +
      '</div>';
    btn.addEventListener('click', function(e) { e.stopPropagation(); showPanel(); }, true);
    btn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); showPanel(); }
    }, true);
    return btn;
  }

  function isCorrectParent(el) {
    var p = el && el.parentElement;
    return p && p.classList.contains('flex-1') && p.classList.contains('overflow-hidden');
  }

  function doInject() {
    document.querySelectorAll('#' + BUTTON_ID).forEach(function(el) {
      if (!isCorrectParent(el)) el.remove();
    });
    if (document.getElementById(BUTTON_ID)) return;

    var nav = document.getElementById('chat-history-nav');
    if (!nav) return;

    var outerWrapper = nav.firstElementChild;
    if (!outerWrapper || !outerWrapper.classList.contains('flex-1') || !outerWrapper.classList.contains('overflow-hidden')) return;

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
  }

  // Poll-based injection
  setInterval(doInject, 600);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(doInject, 500); });
  } else {
    setTimeout(doInject, 500);
  }
})();
