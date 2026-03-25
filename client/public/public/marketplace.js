/**
 * Street Voices Agent Marketplace
 * Transforms LobeHub /discover into a premium agent store.
 * Injected via sv-platform.js on LobeHub pages.
 *
 * Design: Luxury tech marketplace — dark base, gold accents, glass-morphism.
 */
(function () {
  'use strict';

  // Only run on LobeHub (port 3181)
  if (!window.location.host.includes('3181')) return;

  // ═══════════════════════════════════════════════════════════════════
  // PRICING DATA
  // ═══════════════════════════════════════════════════════════════════
  var PRICING = {
    // Premium tier
    'streetvoices-ceo':                    { price: 49, tier: 'premium', label: 'Executive' },
    'streetvoices-auto':                   { price: 49, tier: 'premium', label: 'Executive' },
    // Team leads
    'streetvoices-communication-manager':  { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-content-manager':        { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-development-manager':    { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-finance-manager':        { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-grant-manager':          { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-research-manager':       { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-scraping-manager':       { price: 29, tier: 'pro', label: 'Team Lead' },
    'streetvoices-security-compliance':    { price: 29, tier: 'pro', label: 'Specialist' },
    // Specialists
    'streetvoices-email-agent':            { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-slack-agent':            { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-whatsapp-agent':         { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-calendar-agent':         { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-article-researcher':     { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-article-writer':         { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-social-media-manager':   { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-backend-developer':      { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-frontend-developer':     { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-database-manager':       { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-devops':                 { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-accounting-agent':       { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-crypto-agent':           { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-grant-writer':           { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-budget-manager':         { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-project-manager':        { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-media-platform-researcher': { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-media-program-researcher':  { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-street-bot-researcher':     { price: 19, tier: 'standard', label: 'Agent' },
    'streetvoices-scraping-agent':         { price: 19, tier: 'standard', label: 'Agent' },
    // Memory agents
    'streetvoices-communication-memory':   { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-content-memory':         { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-development-memory':     { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-executive-memory':       { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-finance-memory':         { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-grant-memory':           { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-research-memory':        { price: 9, tier: 'memory', label: 'Memory' },
    'streetvoices-scraper-memory':         { price: 9, tier: 'memory', label: 'Memory' },
  };

  // Bundles removed per user request

  // ═══════════════════════════════════════════════════════════════════
  // CART STATE
  // ═══════════════════════════════════════════════════════════════════
  var cart = JSON.parse(localStorage.getItem('sv_cart') || '[]');
  function saveCart() { localStorage.setItem('sv_cart', JSON.stringify(cart)); }
  function cartTotal() { return cart.reduce(function (s, i) { return s + i.price; }, 0); }
  function addToCart(item) {
    if (cart.find(function (c) { return c.id === item.id; })) return;
    cart.push(item);
    saveCart();
    updateCartUI();
  }
  function removeFromCart(id) {
    cart = cart.filter(function (c) { return c.id !== id; });
    saveCart();
    updateCartUI();
  }

  // ═══════════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('sv-marketplace-css')) return;
    var style = document.createElement('style');
    style.id = 'sv-marketplace-css';
    style.textContent = '\n\
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");\n\
\n\
:root {\n\
  --sv-gold: #D4AF37;\n\
  --sv-gold-dim: #B8962E;\n\
  --sv-gold-glow: rgba(212, 175, 55, 0.15);\n\
  --sv-gold-bright: #F0D060;\n\
  --sv-dark: #0A0A0F;\n\
  --sv-card: rgba(18, 18, 28, 0.85);\n\
  --sv-card-border: rgba(212, 175, 55, 0.12);\n\
  --sv-card-hover: rgba(212, 175, 55, 0.08);\n\
  --sv-surface: rgba(25, 25, 40, 0.95);\n\
  --sv-text: #E8E4DC;\n\
  --sv-text-dim: #8A8676;\n\
  --sv-green: #2ECC71;\n\
  --sv-tier-premium: linear-gradient(135deg, #D4AF37, #F0D060);\n\
  --sv-tier-pro: linear-gradient(135deg, #C0C0C0, #E8E8E8);\n\
  --sv-tier-standard: linear-gradient(135deg, #CD7F32, #E8A850);\n\
  --sv-tier-memory: linear-gradient(135deg, #6A5ACD, #9B8FE8);\n\
  --sv-radius: 12px;\n\
}\n\
\n\
/* ── Marketplace Banner ──────────────────────────────────── */\n\
.sv-mkt-banner {\n\
  position: relative;\n\
  margin: 0 0 32px 0;\n\
  padding: 48px 40px;\n\
  background: linear-gradient(135deg, #0A0A1A 0%, #141428 50%, #0D0D1F 100%);\n\
  border: 1px solid var(--sv-card-border);\n\
  border-radius: 20px;\n\
  overflow: hidden;\n\
  font-family: "Space Grotesk", sans-serif;\n\
}\n\
.sv-mkt-banner::before {\n\
  content: "";\n\
  position: absolute;\n\
  top: -50%;\n\
  right: -10%;\n\
  width: 500px;\n\
  height: 500px;\n\
  background: radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%);\n\
  pointer-events: none;\n\
}\n\
.sv-mkt-banner::after {\n\
  content: "";\n\
  position: absolute;\n\
  bottom: 0;\n\
  left: 0;\n\
  right: 0;\n\
  height: 1px;\n\
  background: linear-gradient(90deg, transparent, var(--sv-gold-dim), transparent);\n\
}\n\
.sv-mkt-banner h1 {\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 36px;\n\
  font-weight: 700;\n\
  letter-spacing: -1px;\n\
  color: var(--sv-text);\n\
  margin: 0 0 8px;\n\
  line-height: 1.1;\n\
}\n\
.sv-mkt-banner h1 span {\n\
  background: var(--sv-tier-premium);\n\
  -webkit-background-clip: text;\n\
  -webkit-text-fill-color: transparent;\n\
  background-clip: text;\n\
}\n\
.sv-mkt-banner p {\n\
  font-size: 16px;\n\
  color: var(--sv-text-dim);\n\
  margin: 0 0 24px;\n\
  max-width: 520px;\n\
  line-height: 1.5;\n\
}\n\
.sv-mkt-stats {\n\
  display: flex;\n\
  gap: 32px;\n\
}\n\
.sv-mkt-stat {\n\
  text-align: left;\n\
}\n\
.sv-mkt-stat-val {\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 28px;\n\
  font-weight: 600;\n\
  color: var(--sv-gold);\n\
  line-height: 1;\n\
}\n\
.sv-mkt-stat-lbl {\n\
  font-size: 12px;\n\
  color: var(--sv-text-dim);\n\
  text-transform: uppercase;\n\
  letter-spacing: 1.5px;\n\
  margin-top: 4px;\n\
}\n\
\n\
/* ── Price Badge on Agent Cards ──────────────────────────── */\n\
.sv-price-badge {\n\
  position: absolute;\n\
  top: 8px;\n\
  right: 8px;\n\
  z-index: 10;\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 13px;\n\
  font-weight: 600;\n\
  padding: 4px 10px;\n\
  border-radius: 6px;\n\
  color: #0A0A0F;\n\
  line-height: 1;\n\
  pointer-events: none;\n\
}\n\
.sv-price-badge.premium { background: var(--sv-tier-premium); }\n\
.sv-price-badge.pro { background: var(--sv-tier-pro); }\n\
.sv-price-badge.standard { background: var(--sv-tier-standard); }\n\
.sv-price-badge.memory { background: var(--sv-tier-memory); color: #fff; }\n\
\n\
.sv-tier-label {\n\
  position: absolute;\n\
  bottom: 8px;\n\
  right: 8px;\n\
  z-index: 10;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 9px;\n\
  font-weight: 600;\n\
  letter-spacing: 1px;\n\
  text-transform: uppercase;\n\
  padding: 2px 8px;\n\
  border-radius: 4px;\n\
  background: rgba(255,255,255,0.06);\n\
  color: var(--sv-text-dim);\n\
  pointer-events: none;\n\
}\n\
\n\
/* ── Add to Cart button on cards ─────────────────────────── */\n\
.sv-card-cart-btn {\n\
  position: absolute;\n\
  bottom: 8px;\n\
  left: 8px;\n\
  z-index: 10;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 11px;\n\
  font-weight: 600;\n\
  padding: 5px 12px;\n\
  border-radius: 6px;\n\
  border: 1px solid var(--sv-gold-dim);\n\
  background: rgba(212,175,55,0.1);\n\
  color: var(--sv-gold);\n\
  cursor: pointer;\n\
  transition: all 0.2s;\n\
  opacity: 0;\n\
}\n\
.sv-card-cart-btn:hover {\n\
  background: var(--sv-gold);\n\
  color: #0A0A0F;\n\
}\n\
.sv-card-cart-btn.in-cart {\n\
  background: var(--sv-green);\n\
  color: #fff;\n\
  border-color: var(--sv-green);\n\
  opacity: 1;\n\
}\n\
/* Show on card hover */\n\
*:hover > .sv-card-cart-btn,\n\
.sv-card-cart-btn:focus {\n\
  opacity: 1;\n\
}\n\
\n\
/* ── Floating Cart ───────────────────────────────────────── */\n\
.sv-cart-fab {\n\
  position: fixed;\n\
  bottom: 24px;\n\
  right: 24px;\n\
  z-index: 9999;\n\
  width: 56px;\n\
  height: 56px;\n\
  border-radius: 50%;\n\
  background: var(--sv-tier-premium);\n\
  border: none;\n\
  cursor: pointer;\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
  font-size: 24px;\n\
  box-shadow: 0 4px 24px rgba(212,175,55,0.3);\n\
  transition: all 0.3s;\n\
}\n\
.sv-cart-fab:hover {\n\
  transform: scale(1.1);\n\
  box-shadow: 0 6px 32px rgba(212,175,55,0.5);\n\
}\n\
.sv-cart-count {\n\
  position: absolute;\n\
  top: -4px;\n\
  right: -4px;\n\
  background: #E74C3C;\n\
  color: #fff;\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 11px;\n\
  font-weight: 700;\n\
  width: 22px;\n\
  height: 22px;\n\
  border-radius: 50%;\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
}\n\
\n\
/* ── Cart Panel ──────────────────────────────────────────── */\n\
.sv-cart-panel {\n\
  position: fixed;\n\
  top: 0;\n\
  right: -420px;\n\
  width: 400px;\n\
  height: 100vh;\n\
  z-index: 10000;\n\
  background: var(--sv-surface);\n\
  border-left: 1px solid var(--sv-card-border);\n\
  backdrop-filter: blur(20px);\n\
  transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n\
  display: flex;\n\
  flex-direction: column;\n\
  font-family: "Space Grotesk", sans-serif;\n\
}\n\
.sv-cart-panel.open { right: 0; }\n\
.sv-cart-overlay {\n\
  position: fixed;\n\
  top: 0; left: 0; right: 0; bottom: 0;\n\
  z-index: 9998;\n\
  background: rgba(0,0,0,0.5);\n\
  opacity: 0;\n\
  visibility: hidden;\n\
  transition: all 0.3s;\n\
}\n\
.sv-cart-overlay.open { opacity: 1; visibility: visible; }\n\
.sv-cart-header {\n\
  padding: 24px;\n\
  border-bottom: 1px solid var(--sv-card-border);\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: space-between;\n\
}\n\
.sv-cart-header h2 {\n\
  font-size: 20px;\n\
  font-weight: 600;\n\
  color: var(--sv-text);\n\
  margin: 0;\n\
}\n\
.sv-cart-close {\n\
  width: 32px;\n\
  height: 32px;\n\
  border-radius: 8px;\n\
  border: 1px solid rgba(255,255,255,0.08);\n\
  background: none;\n\
  color: var(--sv-text-dim);\n\
  font-size: 18px;\n\
  cursor: pointer;\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
}\n\
.sv-cart-close:hover { border-color: var(--sv-gold-dim); color: var(--sv-gold); }\n\
.sv-cart-items {\n\
  flex: 1;\n\
  overflow-y: auto;\n\
  padding: 16px 24px;\n\
}\n\
.sv-cart-item {\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: space-between;\n\
  padding: 12px 0;\n\
  border-bottom: 1px solid rgba(255,255,255,0.04);\n\
}\n\
.sv-cart-item-name {\n\
  font-size: 14px;\n\
  color: var(--sv-text);\n\
  font-weight: 500;\n\
}\n\
.sv-cart-item-price {\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 14px;\n\
  color: var(--sv-gold);\n\
  font-weight: 600;\n\
}\n\
.sv-cart-item-remove {\n\
  background: none;\n\
  border: none;\n\
  color: var(--sv-text-dim);\n\
  cursor: pointer;\n\
  font-size: 16px;\n\
  padding: 4px;\n\
  margin-left: 8px;\n\
}\n\
.sv-cart-item-remove:hover { color: #E74C3C; }\n\
.sv-cart-empty {\n\
  text-align: center;\n\
  padding: 60px 20px;\n\
  color: var(--sv-text-dim);\n\
  font-size: 14px;\n\
}\n\
.sv-cart-empty-icon {\n\
  font-size: 48px;\n\
  margin-bottom: 12px;\n\
  opacity: 0.5;\n\
}\n\
.sv-cart-footer {\n\
  padding: 24px;\n\
  border-top: 1px solid var(--sv-card-border);\n\
}\n\
.sv-cart-total {\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: space-between;\n\
  margin-bottom: 8px;\n\
}\n\
.sv-cart-total-label {\n\
  font-size: 14px;\n\
  color: var(--sv-text-dim);\n\
}\n\
.sv-cart-total-val {\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 24px;\n\
  font-weight: 700;\n\
  color: var(--sv-gold);\n\
}\n\
.sv-cart-total-val span {\n\
  font-size: 13px;\n\
  color: var(--sv-text-dim);\n\
  font-weight: 400;\n\
}\n\
.sv-cart-checkout {\n\
  width: 100%;\n\
  padding: 14px;\n\
  margin-top: 12px;\n\
  background: var(--sv-tier-premium);\n\
  color: #0A0A0F;\n\
  border: none;\n\
  border-radius: 10px;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 15px;\n\
  font-weight: 700;\n\
  cursor: pointer;\n\
  letter-spacing: 0.5px;\n\
  transition: all 0.2s;\n\
}\n\
.sv-cart-checkout:hover {\n\
  filter: brightness(1.15);\n\
  transform: scale(1.01);\n\
}\n\
.sv-cart-crypto {\n\
  width: 100%;\n\
  padding: 12px;\n\
  margin-top: 8px;\n\
  background: none;\n\
  color: var(--sv-text);\n\
  border: 1px solid rgba(255,255,255,0.1);\n\
  border-radius: 10px;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 13px;\n\
  font-weight: 500;\n\
  cursor: pointer;\n\
  transition: all 0.2s;\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
  gap: 8px;\n\
}\n\
.sv-cart-crypto:hover {\n\
  border-color: var(--sv-gold-dim);\n\
  background: rgba(212,175,55,0.05);\n\
}\n\
\n\
/* ── Payment Modal ───────────────────────────────────────── */\n\
.sv-pay-modal-overlay {\n\
  position: fixed;\n\
  top: 0; left: 0; right: 0; bottom: 0;\n\
  z-index: 10001;\n\
  background: rgba(0,0,0,0.7);\n\
  display: none;\n\
  align-items: center;\n\
  justify-content: center;\n\
  font-family: "Space Grotesk", sans-serif;\n\
}\n\
.sv-pay-modal-overlay.open { display: flex; }\n\
.sv-pay-modal {\n\
  background: var(--sv-surface);\n\
  border: 1px solid var(--sv-card-border);\n\
  border-radius: 20px;\n\
  width: 480px;\n\
  max-width: 95vw;\n\
  max-height: 90vh;\n\
  overflow-y: auto;\n\
  padding: 32px;\n\
}\n\
.sv-pay-title {\n\
  font-size: 24px;\n\
  font-weight: 700;\n\
  color: var(--sv-text);\n\
  margin: 0 0 4px;\n\
}\n\
.sv-pay-subtitle {\n\
  font-size: 13px;\n\
  color: var(--sv-text-dim);\n\
  margin: 0 0 24px;\n\
}\n\
.sv-pay-tabs {\n\
  display: flex;\n\
  gap: 8px;\n\
  margin-bottom: 24px;\n\
}\n\
.sv-pay-tab {\n\
  flex: 1;\n\
  padding: 10px;\n\
  border: 1px solid rgba(255,255,255,0.08);\n\
  border-radius: 10px;\n\
  background: none;\n\
  color: var(--sv-text-dim);\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 13px;\n\
  font-weight: 500;\n\
  cursor: pointer;\n\
  text-align: center;\n\
  transition: all 0.2s;\n\
}\n\
.sv-pay-tab.active {\n\
  border-color: var(--sv-gold-dim);\n\
  background: var(--sv-gold-glow);\n\
  color: var(--sv-gold);\n\
}\n\
.sv-pay-tab:hover:not(.active) {\n\
  border-color: rgba(255,255,255,0.15);\n\
  color: var(--sv-text);\n\
}\n\
.sv-pay-section { margin-bottom: 20px; }\n\
.sv-pay-label {\n\
  display: block;\n\
  font-size: 12px;\n\
  font-weight: 500;\n\
  color: var(--sv-text-dim);\n\
  text-transform: uppercase;\n\
  letter-spacing: 1px;\n\
  margin-bottom: 8px;\n\
}\n\
.sv-pay-input {\n\
  width: 100%;\n\
  padding: 12px 14px;\n\
  background: rgba(0,0,0,0.3);\n\
  border: 1px solid rgba(255,255,255,0.08);\n\
  border-radius: 8px;\n\
  color: var(--sv-text);\n\
  font-family: "JetBrains Mono", monospace;\n\
  font-size: 14px;\n\
  outline: none;\n\
  transition: border-color 0.2s;\n\
  box-sizing: border-box;\n\
}\n\
.sv-pay-input:focus { border-color: var(--sv-gold-dim); }\n\
.sv-pay-input::placeholder { color: var(--sv-text-dim); opacity: 0.5; }\n\
.sv-pay-row {\n\
  display: flex;\n\
  gap: 12px;\n\
}\n\
.sv-pay-row > div { flex: 1; }\n\
.sv-pay-submit {\n\
  width: 100%;\n\
  padding: 14px;\n\
  margin-top: 8px;\n\
  background: var(--sv-tier-premium);\n\
  color: #0A0A0F;\n\
  border: none;\n\
  border-radius: 10px;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 15px;\n\
  font-weight: 700;\n\
  cursor: pointer;\n\
  transition: all 0.2s;\n\
}\n\
.sv-pay-submit:hover { filter: brightness(1.15); }\n\
.sv-pay-cancel {\n\
  width: 100%;\n\
  padding: 10px;\n\
  margin-top: 8px;\n\
  background: none;\n\
  color: var(--sv-text-dim);\n\
  border: none;\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 13px;\n\
  cursor: pointer;\n\
}\n\
.sv-pay-cancel:hover { color: var(--sv-text); }\n\
.sv-pay-crypto-wallets {\n\
  display: flex;\n\
  flex-direction: column;\n\
  gap: 10px;\n\
}\n\
.sv-pay-wallet-btn {\n\
  display: flex;\n\
  align-items: center;\n\
  gap: 12px;\n\
  padding: 14px 16px;\n\
  background: rgba(0,0,0,0.3);\n\
  border: 1px solid rgba(255,255,255,0.08);\n\
  border-radius: 10px;\n\
  color: var(--sv-text);\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 14px;\n\
  font-weight: 500;\n\
  cursor: pointer;\n\
  transition: all 0.2s;\n\
}\n\
.sv-pay-wallet-btn:hover {\n\
  border-color: var(--sv-gold-dim);\n\
  background: rgba(212,175,55,0.05);\n\
}\n\
.sv-pay-wallet-icon {\n\
  font-size: 22px;\n\
}\n\
.sv-pay-wallet-info {\n\
  flex: 1;\n\
}\n\
.sv-pay-wallet-name {\n\
  font-weight: 600;\n\
}\n\
.sv-pay-wallet-desc {\n\
  font-size: 11px;\n\
  color: var(--sv-text-dim);\n\
}\n\
.sv-pay-secure {\n\
  text-align: center;\n\
  margin-top: 16px;\n\
  font-size: 11px;\n\
  color: var(--sv-text-dim);\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
  gap: 6px;\n\
}\n\
\n\
/* ── Agents Section Title ────────────────────────────────── */\n\
.sv-agents-title {\n\
  font-family: "Space Grotesk", sans-serif;\n\
  font-size: 22px;\n\
  font-weight: 600;\n\
  color: var(--sv-text);\n\
  margin: 0 0 16px;\n\
  letter-spacing: -0.5px;\n\
  display: flex;\n\
  align-items: center;\n\
  gap: 10px;\n\
}\n\
.sv-agents-title::after {\n\
  content: "";\n\
  flex: 1;\n\
  height: 1px;\n\
  background: linear-gradient(90deg, var(--sv-card-border), transparent);\n\
}\n\
\n\
/* ── Payment Success ─────────────────────────────────────── */\n\
.sv-success-animation {\n\
  text-align: center;\n\
  padding: 40px 20px;\n\
}\n\
.sv-success-check {\n\
  font-size: 64px;\n\
  margin-bottom: 16px;\n\
  animation: sv-pop 0.4s ease;\n\
}\n\
@keyframes sv-pop {\n\
  0% { transform: scale(0); opacity: 0; }\n\
  60% { transform: scale(1.2); }\n\
  100% { transform: scale(1); opacity: 1; }\n\
}\n\
.sv-success-title {\n\
  font-size: 22px;\n\
  font-weight: 700;\n\
  color: var(--sv-text);\n\
  margin-bottom: 8px;\n\
}\n\
.sv-success-msg {\n\
  font-size: 14px;\n\
  color: var(--sv-text-dim);\n\
  line-height: 1.5;\n\
}\n\
';
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CART UI
  // ═══════════════════════════════════════════════════════════════════
  var cartOpen = false;

  function createCartUI() {
    if (document.getElementById('sv-cart-fab')) return;

    // FAB
    var fab = document.createElement('button');
    fab.id = 'sv-cart-fab';
    fab.className = 'sv-cart-fab';
    fab.innerHTML = '\u{1F6D2}';
    fab.onclick = function () { toggleCart(); };
    document.body.appendChild(fab);

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'sv-cart-overlay';
    overlay.className = 'sv-cart-overlay';
    overlay.onclick = function () { toggleCart(false); };
    document.body.appendChild(overlay);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'sv-cart-panel';
    panel.className = 'sv-cart-panel';
    panel.innerHTML = '\
      <div class="sv-cart-header">\
        <h2>\u{1F6D2} Cart</h2>\
        <button class="sv-cart-close" onclick="document.getElementById(\'sv-cart-panel\').classList.remove(\'open\');document.getElementById(\'sv-cart-overlay\').classList.remove(\'open\');">\u2715</button>\
      </div>\
      <div class="sv-cart-items" id="sv-cart-items"></div>\
      <div class="sv-cart-footer" id="sv-cart-footer"></div>';
    document.body.appendChild(panel);

    // Payment modal
    var payModal = document.createElement('div');
    payModal.id = 'sv-pay-modal-overlay';
    payModal.className = 'sv-pay-modal-overlay';
    document.body.appendChild(payModal);

    updateCartUI();
  }

  function toggleCart(force) {
    cartOpen = force !== undefined ? force : !cartOpen;
    var panel = document.getElementById('sv-cart-panel');
    var overlay = document.getElementById('sv-cart-overlay');
    if (panel) panel.classList.toggle('open', cartOpen);
    if (overlay) overlay.classList.toggle('open', cartOpen);
  }

  function updateCartUI() {
    var fab = document.getElementById('sv-cart-fab');
    if (fab) {
      var existing = fab.querySelector('.sv-cart-count');
      if (existing) existing.remove();
      if (cart.length > 0) {
        var badge = document.createElement('span');
        badge.className = 'sv-cart-count';
        badge.textContent = cart.length;
        fab.appendChild(badge);
      }
    }

    var items = document.getElementById('sv-cart-items');
    if (items) {
      if (cart.length === 0) {
        items.innerHTML = '<div class="sv-cart-empty"><div class="sv-cart-empty-icon">\u{1F6D2}</div>Your cart is empty<br><span style="font-size:12px;opacity:0.6">Browse agents to get started</span></div>';
      } else {
        items.innerHTML = cart.map(function (item) {
          return '<div class="sv-cart-item">\
            <span class="sv-cart-item-name">' + item.name + '</span>\
            <span class="sv-cart-item-price">$' + item.price + '</span>\
            <button class="sv-cart-item-remove" data-id="' + item.id + '">\u2715</button>\
          </div>';
        }).join('');
        items.querySelectorAll('.sv-cart-item-remove').forEach(function (btn) {
          btn.onclick = function () { removeFromCart(btn.dataset.id); };
        });
      }
    }

    var footer = document.getElementById('sv-cart-footer');
    if (footer) {
      if (cart.length === 0) {
        footer.innerHTML = '';
      } else {
        var total = cartTotal();
        footer.innerHTML = '\
          <div class="sv-cart-total">\
            <span class="sv-cart-total-label">Monthly total</span>\
            <span class="sv-cart-total-val">$' + total + '<span>/mo</span></span>\
          </div>\
          <button class="sv-cart-checkout" id="sv-checkout-usd">\u{1F4B3} Pay with Card \u2014 $' + total + '/mo</button>\
          <button class="sv-cart-crypto" id="sv-checkout-crypto">\u26A1 Pay with Crypto (ETH \u00B7 BTC \u00B7 USDC)</button>';
        document.getElementById('sv-checkout-usd').onclick = function () { openPayModal('usd'); };
        document.getElementById('sv-checkout-crypto').onclick = function () { openPayModal('crypto'); };
      }
    }

    // Update add-to-cart buttons
    document.querySelectorAll('.sv-card-cart-btn').forEach(function (btn) {
      var inCart = cart.find(function (c) { return c.id === btn.dataset.id; });
      btn.textContent = inCart ? '\u2713 In Cart' : '+ Add';
      btn.classList.toggle('in-cart', !!inCart);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAYMENT MODAL
  // ═══════════════════════════════════════════════════════════════════
  function openPayModal(method) {
    toggleCart(false);
    var overlay = document.getElementById('sv-pay-modal-overlay');
    var total = cartTotal();

    if (method === 'usd') {
      overlay.innerHTML = '\
        <div class="sv-pay-modal">\
          <div class="sv-pay-title">\u{1F4B3} Card Payment</div>\
          <div class="sv-pay-subtitle">Subscribe to ' + cart.length + ' agent' + (cart.length > 1 ? 's' : '') + ' \u2014 $' + total + '/month</div>\
          <div class="sv-pay-section">\
            <label class="sv-pay-label">Email</label>\
            <input class="sv-pay-input" type="email" placeholder="you@company.com">\
          </div>\
          <div class="sv-pay-section">\
            <label class="sv-pay-label">Card Number</label>\
            <input class="sv-pay-input" type="text" placeholder="4242 4242 4242 4242" maxlength="19">\
          </div>\
          <div class="sv-pay-row">\
            <div class="sv-pay-section">\
              <label class="sv-pay-label">Expiry</label>\
              <input class="sv-pay-input" type="text" placeholder="MM / YY" maxlength="7">\
            </div>\
            <div class="sv-pay-section">\
              <label class="sv-pay-label">CVC</label>\
              <input class="sv-pay-input" type="text" placeholder="123" maxlength="4">\
            </div>\
          </div>\
          <button class="sv-pay-submit" onclick="window.__svPaySuccess()">Subscribe \u2014 $' + total + '/mo</button>\
          <button class="sv-pay-cancel" onclick="document.getElementById(\'sv-pay-modal-overlay\').classList.remove(\'open\')">Cancel</button>\
          <div class="sv-pay-secure">\u{1F512} Secured by Stripe \u00B7 256-bit SSL encryption</div>\
        </div>';
    } else {
      overlay.innerHTML = '\
        <div class="sv-pay-modal">\
          <div class="sv-pay-title">\u26A1 Crypto Payment</div>\
          <div class="sv-pay-subtitle">Pay $' + total + '/month in crypto \u2014 auto-renews monthly</div>\
          <div class="sv-pay-tabs">\
            <button class="sv-pay-tab active">Connect Wallet</button>\
            <button class="sv-pay-tab">Manual Transfer</button>\
          </div>\
          <div class="sv-pay-crypto-wallets">\
            <button class="sv-pay-wallet-btn" onclick="window.__svPaySuccess()">\
              <span class="sv-pay-wallet-icon">\u{1F98A}</span>\
              <span class="sv-pay-wallet-info">\
                <span class="sv-pay-wallet-name">MetaMask</span><br>\
                <span class="sv-pay-wallet-desc">Pay with ETH or USDC on Ethereum / Base</span>\
              </span>\
            </button>\
            <button class="sv-pay-wallet-btn" onclick="window.__svPaySuccess()">\
              <span class="sv-pay-wallet-icon">\u{1F47B}</span>\
              <span class="sv-pay-wallet-info">\
                <span class="sv-pay-wallet-name">Phantom</span><br>\
                <span class="sv-pay-wallet-desc">Pay with SOL or USDC on Solana</span>\
              </span>\
            </button>\
            <button class="sv-pay-wallet-btn" onclick="window.__svPaySuccess()">\
              <span class="sv-pay-wallet-icon">\u{1F310}</span>\
              <span class="sv-pay-wallet-info">\
                <span class="sv-pay-wallet-name">WalletConnect</span><br>\
                <span class="sv-pay-wallet-desc">Connect any compatible wallet</span>\
              </span>\
            </button>\
            <button class="sv-pay-wallet-btn" onclick="window.__svPaySuccess()">\
              <span class="sv-pay-wallet-icon">\u20BF</span>\
              <span class="sv-pay-wallet-info">\
                <span class="sv-pay-wallet-name">Bitcoin</span><br>\
                <span class="sv-pay-wallet-desc">Pay with BTC via Lightning or on-chain</span>\
              </span>\
            </button>\
          </div>\
          <button class="sv-pay-cancel" onclick="document.getElementById(\'sv-pay-modal-overlay\').classList.remove(\'open\')">Cancel</button>\
          <div class="sv-pay-secure">\u{1F512} Non-custodial \u00B7 Smart contract escrow</div>\
        </div>';
    }
    overlay.classList.add('open');
  }

  window.__svPaySuccess = function () {
    var overlay = document.getElementById('sv-pay-modal-overlay');
    overlay.innerHTML = '\
      <div class="sv-pay-modal">\
        <div class="sv-success-animation">\
          <div class="sv-success-check">\u2705</div>\
          <div class="sv-success-title">You\'re In!</div>\
          <div class="sv-success-msg">Your agents are being deployed to your workspace. You\'ll receive a confirmation email with setup instructions.</div>\
        </div>\
        <button class="sv-pay-submit" onclick="document.getElementById(\'sv-pay-modal-overlay\').classList.remove(\'open\')">Go to My Agents</button>\
      </div>';
    cart = [];
    saveCart();
    updateCartUI();
  };

  // Banner and bundles removed — marketplace.js only handles price badges, cart, and payment

  // ═══════════════════════════════════════════════════════════════════
  // AGENT CARD INJECTION
  // ═══════════════════════════════════════════════════════════════════
  function injectPriceBadges() {
    // LobeHub agent cards contain links with the agent identifier in href
    // e.g., /discover/assistant/streetvoices-ceo
    var cards = document.querySelectorAll('a[href*="streetvoices-"]');
    cards.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var match = href.match(/(streetvoices-[a-z_-]+)/);
      if (!match) return;

      var id = match[1];
      var pricing = PRICING[id];
      if (!pricing) return;

      // Find the card container (the clickable element or its parent)
      var card = link;
      // Walk up to find the actual card container with position
      var maxWalk = 5;
      while (card && maxWalk-- > 0) {
        var style = window.getComputedStyle(card);
        if (style.position === 'relative' || style.position === 'absolute') break;
        card = card.parentElement;
      }
      if (!card) card = link;

      // Make card position relative for badge placement
      if (window.getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }

      // Skip if already tagged
      if (card.querySelector('.sv-price-badge')) return;

      // Price badge
      var badge = document.createElement('div');
      badge.className = 'sv-price-badge ' + pricing.tier;
      badge.textContent = '$' + pricing.price + '/mo';
      card.appendChild(badge);

      // Tier label
      var label = document.createElement('div');
      label.className = 'sv-tier-label';
      label.textContent = pricing.label;
      card.appendChild(label);

      // Add to cart button
      var cartBtn = document.createElement('button');
      cartBtn.className = 'sv-card-cart-btn';
      cartBtn.dataset.id = id;
      var inCart = cart.find(function (c) { return c.id === id; });
      cartBtn.textContent = inCart ? '\u2713 In Cart' : '+ Add';
      if (inCart) cartBtn.classList.add('in-cart');
      cartBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var already = cart.find(function (c) { return c.id === id; });
        if (already) {
          removeFromCart(id);
        } else {
          // Get agent title from the card text
          var titleEl = card.querySelector('h3, [class*="title"], [class*="Title"]');
          var name = titleEl ? titleEl.textContent.trim() : id.replace('streetvoices-', '').replace(/-/g, ' ');
          addToCart({ id: id, name: name, price: pricing.price, type: 'agent' });
        }
      };
      card.appendChild(cartBtn);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // MARKETPLACE INJECTION — /discover page
  // ═══════════════════════════════════════════════════════════════════
  var marketplaceInjected = false;

  function injectMarketplace() {
    // Only on discover page
    if (!window.location.pathname.startsWith('/discover')) return;
    if (marketplaceInjected) {
      // Just re-inject price badges (React may have re-rendered cards)
      injectPriceBadges();
      return;
    }

    // Find the main content scrollable area
    // LobeHub discover has a scrollable container with agent cards
    // Look for the main content area by finding agent card containers
    var agentLinks = document.querySelectorAll('a[href*="streetvoices-"]');
    if (agentLinks.length < 3) return; // Wait for cards to render

    // Find the scrollable parent that contains all agent cards
    var scrollParent = agentLinks[0];
    var maxWalk = 15;
    while (scrollParent && maxWalk-- > 0) {
      var style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }

    if (!scrollParent) {
      // Fallback: look for main/content areas
      scrollParent = document.querySelector('main, [class*="content"], [class*="Content"]');
    }
    if (!scrollParent) return;

    // Find or create the insertion point — before the agent grid
    // The grid is usually a direct child of the scroll parent
    var gridContainer = agentLinks[0].parentElement;
    while (gridContainer && gridContainer.parentElement !== scrollParent) {
      gridContainer = gridContainer.parentElement;
    }

    if (gridContainer && gridContainer.parentElement === scrollParent) {
      // Insert banner before the grid
      var existingBanner = scrollParent.querySelector('.sv-mkt-banner');
      if (!existingBanner) {
        // Banner and section titles removed
      }
    } else {
      // Alternative approach — banner and titles removed
    }

    injectPriceBadges();
    marketplaceInjected = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  // LOBEHUB LOCKDOWN — Only the Assistant page exists
  // ═══════════════════════════════════════════════════════════════════
  function lockdownLobeHub() {
    // 1) Nuke any leftover banner / title elements (from cache or stale injection)
    document.querySelectorAll('.sv-mkt-banner, .sv-agents-title').forEach(function (el) { el.remove(); });

    // 2) Hide LobeHub tabs that aren't "Assistant"
    //    The discover page header has tabs: Home, Assistant, MCP Plugin, Model, Model Provider
    //    We want ONLY "Assistant" to remain
    var tabLinks = document.querySelectorAll('a[href="/discover"], a[href="/discover/plugins"], a[href="/discover/models"], a[href="/discover/providers"]');
    tabLinks.forEach(function (link) {
      // Walk up to the tab/button container
      var tab = link.closest('div') || link;
      tab.style.display = 'none';
    });

    // Also hide by text content — LobeHub renders tabs as divs/spans
    var allNavItems = document.querySelectorAll('nav a, header a, [role="tablist"] a, [role="tablist"] > *, [class*="tab"], [class*="Tab"]');
    allNavItems.forEach(function (el) {
      var text = (el.textContent || '').trim();
      if (text === 'Home' || text === 'MCP Plugin' || text === 'Model' || text === 'Model Provider') {
        el.style.display = 'none';
      }
    });

    // 3) Inject CSS to hide those tabs more aggressively and kill "Discover" header text
    if (!document.getElementById('sv-lobehub-lockdown-css')) {
      var lockCSS = document.createElement('style');
      lockCSS.id = 'sv-lobehub-lockdown-css';
      lockCSS.textContent = '\n\
/* Hide non-assistant tabs in discover header */\n\
a[href="/discover"],\n\
a[href="/discover/plugins"],\n\
a[href="/discover/models"],\n\
a[href="/discover/providers"] { display: none !important; }\n\
\n\
/* Hide LobeHub left ICON sidebar only (narrow bar, not categories) */\n\
nav[class*="sider"],\n\
div[class*="layoutSider"] { display: none !important; }\n\
\n\
/* Kill any "The Agent Market" banner or "Individual Agents" title */\n\
.sv-mkt-banner { display: none !important; }\n\
.sv-agents-title { display: none !important; }\n\
\n\
/* Hide the "Create" button in top right — users should buy, not create */\n\
a[href="/discover/assistant/create"],\n\
a[href="/discover/assistant"] > [class*="create"],\n\
button:has(svg + span) { }\n\
';
      document.head.appendChild(lockCSS);
    }

    // 4) Redirect any non-assistant LobeHub route to /discover/assistant
    var path = window.location.pathname;
    if (path === '/discover' || path === '/discover/' || path === '/discover/home' ||
        path === '/' || path === '/chat' || path === '/settings' ||
        path.startsWith('/discover/plugins') || path.startsWith('/discover/models') ||
        path.startsWith('/discover/providers') || path === '/market') {
      window.location.replace('/discover/assistant');
    }
  }

  function init() {
    injectStyles();
    createCartUI();
    lockdownLobeHub();

    // Run injection
    injectMarketplace();

    // Watch for React re-renders
    var observer = new MutationObserver(function () {
      clearTimeout(observer._debounce);
      observer._debounce = setTimeout(function () {
        lockdownLobeHub();
        if (window.location.pathname.startsWith('/discover')) {
          injectMarketplace();
        }
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Watch for route changes (SPA navigation)
    var lastPath = window.location.pathname;
    setInterval(function () {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        marketplaceInjected = false;
        lockdownLobeHub();
        if (lastPath.startsWith('/discover')) {
          setTimeout(injectMarketplace, 500);
        }
      }
    }, 300);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
