import react from '@vitejs/plugin-react';
// @ts-ignore
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { compression } from 'vite-plugin-compression2';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

function isLocalLikeTarget(target?: string) {
  if (!target) {
    return false;
  }
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?/i.test(target);
}

export default defineConfig(({ mode }) => {
  // Read env at config-evaluation time so shell overrides are honored when
  // running a specific variant locally.
  const fileEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const env = { ...fileEnv, ...process.env };

  const backendPort = (env.BACKEND_PORT && Number(env.BACKEND_PORT)) || 3080;
  const backendURL =
    env.BACKEND_URL ||
    (env.BACKEND_HOST
      ? `http://${env.BACKEND_HOST}:${backendPort}`
      : env.HOST
        ? `http://${env.HOST}:${backendPort}`
        : `http://localhost:${backendPort}`);
  const appVariant = env.VITE_APP_VARIANT || 'streetbot';

  const defaultSbapiTarget = 'https://librechat-api-production.up.railway.app';
  const defaultCmsTarget = 'https://directus-production-8852.up.railway.app';
  const defaultDirectoryApiTarget = 'https://streetvoices-directory.pages.dev';

  const rawSbapiTarget = env.SBAPI_TARGET || defaultSbapiTarget;
  const rawCmsTarget = env.CMS_TARGET || defaultCmsTarget;
  const rawDirectoryApiTarget = env.DIRECTORY_API_TARGET || defaultDirectoryApiTarget;

  const sbapiTarget =
    appVariant === 'directory' && isLocalLikeTarget(rawSbapiTarget)
      ? defaultSbapiTarget
      : rawSbapiTarget;
  const cmsTarget =
    appVariant === 'directory' && isLocalLikeTarget(rawCmsTarget)
      ? defaultCmsTarget
      : rawCmsTarget;
  const directoryApiTarget =
    appVariant === 'directory' && isLocalLikeTarget(rawDirectoryApiTarget)
      ? defaultDirectoryApiTarget
      : rawDirectoryApiTarget;
  const apiTarget = appVariant === 'directory' ? sbapiTarget : backendURL;

  return ({
  base: '',
  server: {
    allowedHosts: process.env.VITE_ALLOWED_HOSTS && process.env.VITE_ALLOWED_HOSTS.split(',') || [],
    host: process.env.HOST || 'localhost',
    port: process.env.PORT && Number(process.env.PORT) || 3090,
    strictPort: false,
    proxy: {
      '/sbapi': {
        target: sbapiTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (proxyPath: string) =>
          appVariant === 'directory' ? proxyPath.replace(/^\/sbapi/, '') : proxyPath,
      },
      '/cms': {
        target: cmsTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path: string) => path.replace(/^\/cms/, ''),
      },
      '/api/directory': {
        target: directoryApiTarget,
        changeOrigin: true,
        secure: true,
      },
      '/admin': {
        target: backendURL,
        changeOrigin: true,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/oauth': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  // Set the directory where environment variables are loaded from and restrict prefixes
  envDir: '../',
  envPrefix: ['VITE_', 'SCRIPT_', 'DOMAIN_', 'ALLOW_'],
  plugins: [
    react(),
    nodePolyfills(),
    VitePWA({
      injectRegister: 'auto', // 'auto' | 'manual' | 'disabled'
      registerType: 'autoUpdate', // 'prompt' | 'autoUpdate'
      devOptions: {
        enabled: false, // disable service worker registration in development mode
      },
      useCredentials: true,
      includeManifestIcons: false,
      workbox: {
        globPatterns: [
          'assets/*.css',
          'assets/favicon*.png',
          'assets/icon-*.png',
          'assets/apple-touch-icon*.png',
          'assets/maskable-icon.png',
          'manifest.webmanifest',
        ],
        globIgnores: ['images/**/*', '**/*.map'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/oauth/,
          /^\/api/,
          /^\/sbapi/,
          /^\/(cms|admin|auth|users|server|utils|collections|fields|relations|roles|permissions|policies|presets|translations|activity|revisions|files|folders|items|dashboards|panels|operations|flows|shares|extensions|graphql)(\/|$)/,
        ],
        runtimeCaching: [
          {
            // Always prefer network for JS so in-flight deploys take effect
            // immediately. Falls back to cache only when offline. Filenames are
            // content-hashed so mixing versions is impossible.
            urlPattern: /^\/assets\/.*\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache-v3',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^\/assets\/.*\.css$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'css-cache-v2',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache-v1',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
      includeAssets: [],
      manifest: {
        name: 'Street Voices',
        short_name: 'Street Voices',
        display: 'standalone',
        background_color: '#1f2027',
        theme_color: '#ffd600',
        icons: [
          {
            src: 'assets/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/maskable-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    sourcemapExclude({ excludeNodeModules: true }),
    compression({
      threshold: 10240,
    }),
  ],
  publicDir: './public',
  build: {
    target: 'es2020',
    sourcemap: process.env.NODE_ENV === 'development',
    outDir: './dist',
    minify: 'terser',
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      output: {
        // manualChunks removed — Rollup's automatic chunking correctly handles
        // circular dependencies. Manual chunking caused TDZ errors (mermaid,
        // codemirror) and useSyncExternalStore errors (tanstack, headlessui).
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0] && /\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.names[0])) {
            return 'assets/fonts/[name][extname]';
          }
          return 'assets/[name].[hash][extname]';
        },
      },
      /**
       * Ignore "use client" warning since we are not using SSR
       * @see {@link https://github.com/TanStack/query/pull/5161#issuecomment-1477389761 Preserve 'use client' directives TanStack/query#5161}
       */
      onwarn(warning, warn) {
        if (warning.message.includes('Error when using sourcemap')) {
          return;
        }
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: {
      '~': path.join(__dirname, 'src/'),
      '@': path.join(__dirname, 'src/components/streetbot'),
      $fonts: path.resolve(__dirname, 'public/fonts'),
      'micromark-extension-math': 'micromark-extension-llm-math',
      'next/navigation': path.join(__dirname, 'src/components/streetbot/shared/next-navigation-shim.ts'),
      'next/link': path.join(__dirname, 'src/components/streetbot/shared/next-link-shim.tsx'),
    },
  },
  });
});

interface SourcemapExclude {
  excludeNodeModules?: boolean;
}

export function sourcemapExclude(opts?: SourcemapExclude): Plugin {
  return {
    name: 'sourcemap-exclude',
    transform(code: string, id: string) {
      if (opts?.excludeNodeModules && id.includes('node_modules')) {
        return {
          code,
          // https://github.com/rollup/rollup/blob/master/docs/plugin-development/index.md#source-code-transformations
          map: { mappings: '' },
        };
      }
    },
  };
}
