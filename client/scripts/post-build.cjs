const fs = require('fs-extra');
const path = require('path');

const DIST_DIR = path.resolve('dist');
const LOCAL_3180_DIST = path.resolve(process.cwd(), '../../../LibreChat/client/dist');
const REPO_ROOT = path.resolve(process.cwd(), '..');
const NGINX_UNIFIED_CONF = path.join(REPO_ROOT, 'nginx-unified.conf');
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

const LOCAL_NOOP_SERVICE_WORKER = `self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', () => {});
`;

async function disableGeneratedServiceWorkerCache() {
  if (process.env.STREETBOT_KEEP_PWA_SW === '1') {
    return;
  }

  const entries = await fs.readdir(DIST_DIR).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => /^workbox-.*\.js$/.test(entry))
      .map((entry) => fs.remove(path.join(DIST_DIR, entry))),
  );
  await fs.writeFile(path.join(DIST_DIR, 'sw.js'), LOCAL_NOOP_SERVICE_WORKER, 'utf8');
  console.log('✅ Local service worker cache reset installed. Set STREETBOT_KEEP_PWA_SW=1 to keep Workbox.');
}

async function listTextBuildFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTextBuildFiles(fullPath)));
      continue;
    }

    if (/\.(html|js|css|json|webmanifest|txt)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function assertNoLegacyStreetBotUi(distDir) {
  const files = await listTextBuildFiles(distDir);
  const hits = [];

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    for (const fingerprint of LEGACY_UI_FINGERPRINTS) {
      if (text.includes(fingerprint)) {
        hits.push(`${path.relative(distDir, file)} contains "${fingerprint}"`);
      }
    }
  }

  if (hits.length > 0) {
    throw new Error(
      `Legacy StreetBot UI fingerprints detected; refusing to publish stale local UI:\n${hits.join(
        '\n',
      )}`,
    );
  }
}

async function assertNginxDoesNotHijackStreetBotAssets() {
  const text = await fs.readFile(NGINX_UNIFIED_CONF, 'utf8').catch(() => '');
  if (!text) {
    return;
  }

  const paperclipIndexAssetHijack =
    /location\s+~\s+\^\/assets\/index-[\s\S]*?proxy_pass\s+http:\/\/paperclip/.test(text);

  if (paperclipIndexAssetHijack) {
    throw new Error(
      [
        'Unsafe nginx asset route detected.',
        'Do not proxy /assets/index-* to Paperclip: Vite emits StreetBot shell chunks with that prefix.',
        `Fix ${NGINX_UNIFIED_CONF} before publishing a local 3180 build.`,
      ].join('\n'),
    );
  }
}

async function stampIndexHtmlWithFreshBuild(distDir, marker) {
  const indexPath = path.join(distDir, 'index.html');
  let html = await fs.readFile(indexPath, 'utf8');
  const metaPattern = new RegExp(
    `\\s*<meta name="${LOCAL_SHELL_META_NAME}" content="[^"]*" \\/?>`,
    'g',
  );
  const meta = `<meta name="${LOCAL_SHELL_META_NAME}" content="${marker.guard}:${marker.builtAt}" />`;

  html = html.replace(metaPattern, '');
  if (html.includes('</head>')) {
    html = html.replace('</head>', `    ${meta}\n  </head>`);
  } else {
    html = `${meta}\n${html}`;
  }

  await fs.writeFile(indexPath, html, 'utf8');
}

async function assertFreshShellMarker(distDir, expectedMarker) {
  const indexPath = path.join(distDir, 'index.html');
  const markerPath = path.join(distDir, '.streetbot-local-build.json');
  const [html, marker] = await Promise.all([
    fs.readFile(indexPath, 'utf8'),
    fs.readJson(markerPath),
  ]);
  const expectedContent = `${expectedMarker.guard}:${expectedMarker.builtAt}`;

  if (marker.guard !== LOCAL_BUILD_GUARD || !html.includes(expectedContent)) {
    throw new Error(
      `Fresh local shell marker missing or stale in ${distDir}. Refusing to publish an unverifiable 3180 shell.`,
    );
  }
}

async function writeLocalBuildMarker(distDir) {
  const marker = {
    builtAt: new Date().toISOString(),
    source: path.resolve('.'),
    guard: LOCAL_BUILD_GUARD,
    active3180Dist: LOCAL_3180_DIST,
  };

  await fs.writeJson(path.join(distDir, '.streetbot-local-build.json'), marker, { spaces: 2 });
  await stampIndexHtmlWithFreshBuild(distDir, marker);
  return marker;
}

async function syncActiveLocal3180Dist() {
  if (process.env.STREETBOT_SKIP_LOCAL_3180_SYNC === '1') {
    if (process.env.STREETBOT_ALLOW_UNSYNCED_3180 !== '1') {
      throw new Error(
        'STREETBOT_SKIP_LOCAL_3180_SYNC is blocked for local 3180 builds. Set STREETBOT_ALLOW_UNSYNCED_3180=1 only when intentionally building a non-3180 artifact.',
      );
    }
    return false;
  }

  const targetParent = path.dirname(LOCAL_3180_DIST);
  const targetExists = await fs.pathExists(targetParent);
  const targetIsCurrentDist = path.resolve(LOCAL_3180_DIST) === DIST_DIR;
  if (!targetExists || targetIsCurrentDist) {
    return false;
  }

  await fs.emptyDir(LOCAL_3180_DIST);
  await fs.copy(DIST_DIR, LOCAL_3180_DIST);
  console.log(`✅ Synced fresh local build to active 3180 dist: ${LOCAL_3180_DIST}`);
  return true;
}

async function assertActiveLocal3180Dist(synced) {
  if (!synced) {
    return;
  }

  await assertNoLegacyStreetBotUi(LOCAL_3180_DIST);

  const sourceMarkerPath = path.join(DIST_DIR, '.streetbot-local-build.json');
  const activeMarkerPath = path.join(LOCAL_3180_DIST, '.streetbot-local-build.json');
  const [sourceMarker, activeMarker] = await Promise.all([
    fs.readJson(sourceMarkerPath),
    fs.readJson(activeMarkerPath),
  ]);

  if (
    sourceMarker.builtAt !== activeMarker.builtAt ||
    sourceMarker.source !== activeMarker.source ||
    sourceMarker.guard !== activeMarker.guard ||
    sourceMarker.guard !== LOCAL_BUILD_GUARD
  ) {
    throw new Error(
      `Active local 3180 dist marker does not match the fresh build marker: ${activeMarkerPath}`,
    );
  }

  await assertFreshShellMarker(LOCAL_3180_DIST, sourceMarker);
  console.log('✅ Active 3180 dist verified against fresh local build marker.');
}

async function postBuild() {
  try {
    await fs.copy('public/assets', 'dist/assets');
    await fs.copy('public/robots.txt', 'dist/robots.txt');
    await assertNginxDoesNotHijackStreetBotAssets();
    await disableGeneratedServiceWorkerCache();
    await assertNoLegacyStreetBotUi(DIST_DIR);
    const marker = await writeLocalBuildMarker(DIST_DIR);
    await assertFreshShellMarker(DIST_DIR, marker);
    const synced = await syncActiveLocal3180Dist();
    await assertActiveLocal3180Dist(synced);
    console.log('✅ PWA icons and robots.txt copied successfully. Glob pattern warnings resolved.');
  } catch (err) {
    console.error('❌ Error copying files:', err);
    process.exit(1);
  }
}

postBuild();
