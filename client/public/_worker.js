const BACKEND_ORIGIN = 'https://librechat-api-production.up.railway.app';
const CMS_ORIGIN = 'https://directus-production-8852.up.railway.app';
const DIRECTORY_ORIGIN = 'https://streetvoices-directory.pages.dev';

function acceptsHtml(request) {
  return (request.headers.get('accept') || '').includes('text/html');
}

function makeProxyRequest(request, origin, rewritePath) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(request.url);
  upstreamUrl.protocol = new URL(origin).protocol;
  upstreamUrl.host = new URL(origin).host;
  upstreamUrl.pathname = rewritePath ? rewritePath(incomingUrl.pathname) : incomingUrl.pathname;

  const headers = new Headers(request.headers);
  headers.delete('host');

  return new Request(upstreamUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  });
}

async function proxy(request, origin, rewritePath) {
  const response = await fetch(makeProxyRequest(request, origin, rewritePath));
  return new Response(response.body, response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/directory')) {
      return proxy(request, DIRECTORY_ORIGIN);
    }

    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/oauth')) {
      return proxy(request, BACKEND_ORIGIN);
    }

    if (url.pathname.startsWith('/sbapi')) {
      return proxy(request, BACKEND_ORIGIN, (pathname) => pathname.replace(/^\/sbapi/, '') || '/');
    }

    if (url.pathname.startsWith('/cms')) {
      return proxy(request, CMS_ORIGIN, (pathname) => pathname.replace(/^\/cms/, '') || '/');
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== 'GET' || !acceptsHtml(request)) {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  },
};
