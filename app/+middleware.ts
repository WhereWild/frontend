import type { MiddlewareFunction } from 'expo-server';

import {
  isCrawlerUserAgent,
  parseSpeciesPath,
  renderSpeciesOpenGraphHtml,
} from '@/utils/speciesOpenGraph';

const APP_VARIANT = process.env.APP_VARIANT ?? 'production';
const BACKEND_BASE = process.env.APP_BACKEND_URL || 'http://localhost:8000';

const readForwardedHeader = (value: string | null) =>
  value?.split(',')[0]?.trim() || null;

const resolveRequestOrigin = (url: URL, headers: Headers) => {
  const forwardedProto = readForwardedHeader(headers.get('x-forwarded-proto'));
  const forwardedHost = readForwardedHeader(headers.get('x-forwarded-host'));
  const host = readForwardedHeader(headers.get('host'));
  const resolvedHost = forwardedHost || host;

  if (resolvedHost) {
    return `${forwardedProto || url.protocol.replace(':', '')}://${resolvedHost}`;
  }

  return url.origin;
};

const fetchSpeciesMetadata = async (taxonId: string) => {
  const response = await fetch(
    `${BACKEND_BASE}/api/species/${encodeURIComponent(taxonId)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch species ${taxonId}: ${response.status}`);
  }

  return response.json();
};

const middleware: MiddlewareFunction = async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return;
  }

  if (!isCrawlerUserAgent(request.headers.get('user-agent'))) {
    return;
  }

  const url = new URL(request.url);
  const route = parseSpeciesPath(url.pathname);

  if (!route) {
    return;
  }

  try {
    const payload = await fetchSpeciesMetadata(route.taxonId);
    const html = renderSpeciesOpenGraphHtml({
      noindex: APP_VARIANT !== 'production',
      origin: resolveRequestOrigin(url, request.headers),
      path: url.pathname,
      payload,
      taxonId: route.taxonId,
    });

    return new Response(request.method === 'HEAD' ? null : html, {
      headers: {
        'cache-control': 'public, max-age=300',
        'content-type': 'text/html; charset=utf-8',
        vary: 'User-Agent',
      },
      status: 200,
    });
  } catch (error) {
    console.error('[species-og-middleware] Failed to render metadata:', error);
    return;
  }
};

export default middleware;
