import http from 'node:http';
import { URL, pathToFileURL } from 'node:url';

export const DEFAULT_PROXY_PREFIX = '/nominatim';
export const DEFAULT_UPSTREAM_BASE_URL = 'https://nominatim.openstreetmap.org';
export const DEFAULT_PROXY_HOST = '127.0.0.1';
export const DEFAULT_PROXY_PORT = 8787;
export const DEFAULT_CACHE_TTL_MS = 60_000;
export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_USER_AGENT =
  'GilmaruOpenGeocoderProxy/1.7.13 (+https://github.com/payolajoker/gilmaru-public)';

const ROUTE_QUERY_WHITELIST = {
  '/reverse': new Set([
    'lat',
    'lon',
    'zoom',
    'addressdetails',
    'namedetails',
    'extratags',
    'accept-language',
  ]),
  '/search': new Set([
    'q',
    'limit',
    'addressdetails',
    'namedetails',
    'extratags',
    'countrycodes',
    'viewbox',
    'bounded',
    'dedupe',
    'accept-language',
  ]),
};

export function normalizeProxyOptions(env = process.env) {
  return {
    host: env.OPEN_GEOCODER_HOST || DEFAULT_PROXY_HOST,
    port: Number.parseInt(env.OPEN_GEOCODER_PORT || `${DEFAULT_PROXY_PORT}`, 10) || DEFAULT_PROXY_PORT,
    prefix: normalizePrefix(env.OPEN_GEOCODER_PREFIX || DEFAULT_PROXY_PREFIX),
    upstreamBaseUrl: env.OPEN_GEOCODER_UPSTREAM_BASE_URL || DEFAULT_UPSTREAM_BASE_URL,
    cacheTtlMs: Number.parseInt(env.OPEN_GEOCODER_CACHE_TTL_MS || `${DEFAULT_CACHE_TTL_MS}`, 10) || DEFAULT_CACHE_TTL_MS,
    timeoutMs: Number.parseInt(env.OPEN_GEOCODER_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10) || DEFAULT_TIMEOUT_MS,
    userAgent: env.OPEN_GEOCODER_USER_AGENT || DEFAULT_USER_AGENT,
    contactEmail: (env.OPEN_GEOCODER_CONTACT_EMAIL || '').trim(),
  };
}

function normalizePrefix(prefix) {
  const trimmed = String(prefix || DEFAULT_PROXY_PREFIX).trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function buildUpstreamRequest(inputUrl, options = normalizeProxyOptions()) {
  const requestUrl =
    inputUrl instanceof URL ? inputUrl : new URL(inputUrl, `http://${options.host}:${options.port}`);

  if (requestUrl.pathname === '/healthz') {
    return { kind: 'healthz' };
  }

  if (!requestUrl.pathname.startsWith(`${options.prefix}/`)) {
    return { kind: 'unsupported' };
  }

  const routePath = requestUrl.pathname.slice(options.prefix.length);
  const allowedParams = ROUTE_QUERY_WHITELIST[routePath];
  if (!allowedParams) {
    return { kind: 'unsupported' };
  }

  const upstreamUrl = new URL(routePath, options.upstreamBaseUrl);
  requestUrl.searchParams.forEach((value, key) => {
    if (allowedParams.has(key)) {
      upstreamUrl.searchParams.set(key, value);
    }
  });
  upstreamUrl.searchParams.set('format', 'jsonv2');

  if (options.contactEmail && !upstreamUrl.searchParams.has('email')) {
    upstreamUrl.searchParams.set('email', options.contactEmail);
  }

  return {
    kind: 'proxy',
    routePath,
    upstreamUrl,
    cacheKey: createCacheKey(routePath, upstreamUrl.searchParams),
  };
}

function createCacheKey(routePath, searchParams) {
  const sorted = [...searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const serialized = new URLSearchParams(sorted);
  return `${routePath}?${serialized.toString()}`;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Accept-Language');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export function createOpenGeocoderProxyServer(options = normalizeProxyOptions()) {
  const cache = new Map();

  return http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const requestInfo = buildUpstreamRequest(req.url || '/', options);
    if (requestInfo.kind === 'healthz') {
      sendJson(res, 200, {
        ok: true,
        prefix: options.prefix,
        upstreamBaseUrl: options.upstreamBaseUrl,
        cacheTtlMs: options.cacheTtlMs,
      });
      return;
    }

    if (requestInfo.kind !== 'proxy') {
      sendJson(res, 404, {
        error: 'unsupported_route',
        prefix: options.prefix,
        supportedRoutes: [`${options.prefix}/search`, `${options.prefix}/reverse`],
      });
      return;
    }

    const cached = cache.get(requestInfo.cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.writeHead(cached.statusCode, cached.headers);
      res.end(cached.body);
      return;
    }

    try {
      const upstreamResponse = await fetch(requestInfo.upstreamUrl, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': req.headers['accept-language'] || 'ko',
          'User-Agent': options.userAgent,
        },
        signal: AbortSignal.timeout(options.timeoutMs),
      });

      const body = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${Math.max(0, Math.floor(options.cacheTtlMs / 1000))}`,
      };

      if (upstreamResponse.ok) {
        cache.set(requestInfo.cacheKey, {
          statusCode: upstreamResponse.status,
          headers,
          body,
          expiresAt: Date.now() + options.cacheTtlMs,
        });
      }

      res.writeHead(upstreamResponse.status, headers);
      res.end(body);
    } catch (error) {
      sendJson(res, 502, {
        error: 'upstream_request_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export async function startOpenGeocoderProxy(options = normalizeProxyOptions()) {
  const server = createOpenGeocoderProxyServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, resolve);
  });
  return server;
}

async function main() {
  const options = normalizeProxyOptions();
  const server = await startOpenGeocoderProxy(options);
  const origin = `http://${options.host}:${options.port}${options.prefix}`;
  console.log(`Open geocoder proxy listening on ${origin}`);
  console.log(`Upstream: ${options.upstreamBaseUrl}`);
  console.log(`Health: http://${options.host}:${options.port}/healthz`);

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Failed to start open geocoder proxy:', error);
    process.exit(1);
  });
}
