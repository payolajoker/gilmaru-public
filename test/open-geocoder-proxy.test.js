import { describe, expect, test } from 'vitest';
import {
  buildUpstreamRequest,
  normalizeProxyOptions,
} from '../scripts/open-geocoder-proxy.mjs';

describe('open geocoder proxy helpers', () => {
  test('builds a whitelisted reverse request and forces jsonv2', () => {
    const options = normalizeProxyOptions({
      OPEN_GEOCODER_HOST: '127.0.0.1',
      OPEN_GEOCODER_PORT: '8787',
      OPEN_GEOCODER_CONTACT_EMAIL: 'ops@example.com',
    });

    const request = buildUpstreamRequest(
      'http://127.0.0.1:8787/nominatim/reverse?lat=37.5&lon=127.0&format=xml&foo=bar',
      options
    );

    expect(request.kind).toBe('proxy');
    expect(request.routePath).toBe('/reverse');
    expect(request.upstreamUrl.toString()).toContain('/reverse?');
    expect(request.upstreamUrl.searchParams.get('lat')).toBe('37.5');
    expect(request.upstreamUrl.searchParams.get('lon')).toBe('127.0');
    expect(request.upstreamUrl.searchParams.get('format')).toBe('jsonv2');
    expect(request.upstreamUrl.searchParams.get('foo')).toBe(null);
    expect(request.upstreamUrl.searchParams.get('email')).toBe('ops@example.com');
  });

  test('rejects unsupported routes outside the proxy prefix', () => {
    const request = buildUpstreamRequest('http://127.0.0.1:8787/not-nominatim/search?q=test');
    expect(request.kind).toBe('unsupported');
  });

  test('builds a search request with only allowed parameters', () => {
    const request = buildUpstreamRequest(
      'http://127.0.0.1:8787/nominatim/search?q=gangnam&limit=3&countrycodes=kr&debug=true'
    );

    expect(request.kind).toBe('proxy');
    expect(request.routePath).toBe('/search');
    expect(request.upstreamUrl.searchParams.get('q')).toBe('gangnam');
    expect(request.upstreamUrl.searchParams.get('limit')).toBe('3');
    expect(request.upstreamUrl.searchParams.get('countrycodes')).toBe('kr');
    expect(request.upstreamUrl.searchParams.get('debug')).toBe(null);
    expect(request.upstreamUrl.searchParams.get('format')).toBe('jsonv2');
  });
});
