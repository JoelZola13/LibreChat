const fs = require('fs-extra');
const path = require('path');

const LOCAL_3180_URL = process.env.STREETBOT_LOCAL_3180_URL || 'http://localhost:3180';
const LOCAL_3180_DIST = path.resolve(process.cwd(), '../../../LibreChat/client/dist');
const LOCAL_BUILD_GUARD = 'streetbot-local-3180-fresh-build-v2';
const LOCAL_SHELL_META_NAME = 'streetbot-local-shell-guard';
const LEGACY_UI_FINGERPRINTS = [
  'DISCOVER CREATIVES',
  'Street Profile Directory',
  'CREATE YOUR STREET PROFILE',
  'Discover Creatives',
  'Connect with artists, designers, musicians, and creators. Find',
  'Find talent for your next project or discover inspiring work.',
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const markerPath = path.join(LOCAL_3180_DIST, '.streetbot-local-build.json');
  const marker = await fs.readJson(markerPath).catch(() => null);

  if (!marker || marker.guard !== LOCAL_BUILD_GUARD) {
    fail(`Active 3180 marker missing or stale: ${markerPath}`);
  }

  const expectedMeta = `<meta name="${LOCAL_SHELL_META_NAME}" content="${marker.guard}:${marker.builtAt}"`;
  const localIndex = await fs.readFile(path.join(LOCAL_3180_DIST, 'index.html'), 'utf8');
  if (!localIndex.includes(expectedMeta)) {
    fail(`Active 3180 index.html does not include fresh shell marker ${marker.guard}:${marker.builtAt}`);
  }

  const liveHtml = await fetchText(`${LOCAL_3180_URL}/home?verify=fresh-shell-${Date.now()}`);
  if (!liveHtml.includes(expectedMeta)) {
    fail(`Live ${LOCAL_3180_URL}/home is not serving the active fresh shell marker.`);
  }

  const legacyHit = LEGACY_UI_FINGERPRINTS.find((fingerprint) => liveHtml.includes(fingerprint));
  if (legacyHit) {
    fail(`Live ${LOCAL_3180_URL}/home contains legacy UI fingerprint: "${legacyHit}"`);
  }

  const swResponse = await fetch(`${LOCAL_3180_URL}/sw.js?verify=fresh-shell-${Date.now()}`);
  const cacheControl = swResponse.headers.get('cache-control') || '';
  const swText = await swResponse.text();
  if (!cacheControl.includes('no-store') || !swText.includes('caches.delete')) {
    fail('Live /sw.js is not the local cache-clearing service worker.');
  }

  console.log(`✅ Live ${LOCAL_3180_URL} is serving fresh 3180 shell ${marker.builtAt}.`);
}

main().catch((error) => {
  fail(error?.stack || error?.message || String(error));
});
