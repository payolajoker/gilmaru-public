const DEFAULT_KAKAO_KEY_HOSTS = new Set(['payolajoker.github.io']);
const DEFAULT_RUNTIME_CONFIG_PATHS = ['gilmaru.config.local.json', 'gilmaru.config.json'];
const DEFAULT_KAKAO_SDK_TIMEOUT_MS = 10000;
const DEFAULT_KAKAO_SDK_MAX_RETRIES = 1;
const DEFAULT_LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const DEFAULT_TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const OPEN_GEOCODER_MODES = new Set(['auto', 'direct', 'proxy', 'fallback']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export async function createMapController(options = {}) {
  const requestedProvider = resolveRequestedProvider(options.search || window.location.search, options.env?.VITE_MAP_PROVIDER);
  const kakaoResult =
    requestedProvider === 'open'
      ? { ok: false, skipped: true, reason: 'requested-open-provider' }
      : await tryCreateKakaoController(options);

  if (kakaoResult.ok) {
    return {
      ok: true,
      controller: kakaoResult.controller,
      providerInfo: {
        id: 'kakao',
        label: 'Kakao Maps',
        mode: 'primary',
        supportsAutocomplete: true,
      },
    };
  }

  const openResult = await tryCreateOpenStreetMapController(options);
  if (openResult.ok) {
    const baseNotice =
      requestedProvider === 'open'
        ? 'OpenStreetMap 공개 모드로 실행 중입니다.'
        : 'Kakao 없이 OpenStreetMap 공개 모드로 실행 중입니다.';
    const notice = [baseNotice, openResult.geocoder?.notice].filter(Boolean).join(' ');

    return {
      ok: true,
      controller: openResult.controller,
      providerInfo: {
        id: 'openstreetmap',
        label: 'OpenStreetMap',
        mode: requestedProvider === 'open' ? 'requested' : 'fallback',
        fallbackReason: kakaoResult.reason || '',
        supportsAutocomplete: false,
        geocoderMode: openResult.geocoder?.mode || 'direct',
        notice,
      },
    };
  }

  return {
    ok: false,
    reason: openResult.reason || kakaoResult.reason || 'map-provider-unavailable',
  };
}

function resolveRequestedProvider(search, envProvider = '') {
  const params = new URLSearchParams(search || '');
  const value = (params.get('provider') || params.get('map') || envProvider || '').trim().toLowerCase();
  if (value === 'open' || value === 'osm' || value === 'openstreetmap') return 'open';
  if (value === 'kakao') return 'kakao';
  return 'auto';
}

async function tryCreateKakaoController(options) {
  const { env = {}, windowConfig = {}, appBaseUrl = '/', defaultKakaoJsKey = '', defaultKakaoKeyHosts = DEFAULT_KAKAO_KEY_HOSTS } = options;

  if (window.kakao?.maps?.services) {
    return { ok: true, controller: createKakaoMapController() };
  }

  const keyResolution = await resolveKakaoJsKey({
    env,
    windowConfig,
    appBaseUrl,
    runtimeConfigPaths: options.runtimeConfigPaths || DEFAULT_RUNTIME_CONFIG_PATHS,
    defaultKakaoJsKey,
    defaultKakaoKeyHosts,
  });

  if (!keyResolution.key) {
    return { ok: false, reason: keyResolution.reason || 'missing-kakao-key' };
  }

  for (let attempt = 0; attempt <= (options.kakaoSdkMaxRetries ?? DEFAULT_KAKAO_SDK_MAX_RETRIES); attempt += 1) {
    try {
      ensureExternalScript({
        selector: 'script[data-kakao-sdk="true"]',
        src: getKakaoSdkUrl(keyResolution.key),
        dataset: { kakaoSdk: 'true' },
      });
      await waitForScriptLoad('script[data-kakao-sdk="true"]', options.kakaoSdkTimeoutMs ?? DEFAULT_KAKAO_SDK_TIMEOUT_MS);
      await waitForKakaoMapsLoad();
      return { ok: true, controller: createKakaoMapController() };
    } catch (error) {
      console.error(`Kakao SDK load failed (attempt ${attempt + 1}):`, error);
      const staleScript = document.querySelector('script[data-kakao-sdk="true"]');
      if (staleScript) staleScript.remove();
      if (attempt === (options.kakaoSdkMaxRetries ?? DEFAULT_KAKAO_SDK_MAX_RETRIES)) {
        return { ok: false, reason: 'sdk-load-failed' };
      }
      await waitForMs(700);
    }
  }

  return { ok: false, reason: 'sdk-load-failed' };
}

function createKakaoMapController() {
  const STATUS_OK = window.kakao.maps.services.Status.OK;
  const mapContainer = document.getElementById('map');
  const map = new window.kakao.maps.Map(mapContainer, {
    center: new window.kakao.maps.LatLng(37.4979, 127.0276),
    level: 3,
  });
  const geocoder = new window.kakao.maps.services.Geocoder();
  const placesService = new window.kakao.maps.services.Places();
  let highlightRect = null;
  let pointMarkers = [];

  return {
    id: 'kakao',
    label: 'Kakao Maps',
    supportsAutocomplete: true,
    getCenter() {
      const center = map.getCenter();
      return { lat: center.getLat(), lng: center.getLng() };
    },
    setCenter(lat, lng) {
      map.setCenter(new window.kakao.maps.LatLng(lat, lng));
    },
    getLevel() {
      return map.getLevel();
    },
    setLevel(level) {
      map.setLevel(level);
    },
    getBounds() {
      const bounds = map.getBounds();
      return {
        sw: {
          lat: bounds.getSouthWest().getLat(),
          lng: bounds.getSouthWest().getLng(),
        },
        ne: {
          lat: bounds.getNorthEast().getLat(),
          lng: bounds.getNorthEast().getLng(),
        },
      };
    },
    project(lat, lng) {
      const point = map.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(lat, lng));
      return { x: point.x, y: point.y };
    },
    onIdle(handler) {
      window.kakao.maps.event.addListener(map, 'idle', handler);
    },
    onDragStart(handler) {
      window.kakao.maps.event.addListener(map, 'dragstart', handler);
    },
    async reverseGeocode(lat, lng) {
      return new Promise((resolve) => {
        geocoder.coord2Address(lng, lat, (result, status) => {
          if (status !== STATUS_OK || !result?.[0]) {
            resolve(null);
            return;
          }

          const detail = result[0];
          resolve({
            roadAddress: detail.road_address?.address_name || '',
            jibunAddress: detail.address?.address_name || '',
            buildingName: detail.road_address?.building_name || '',
          });
        });
      });
    },
    async searchPlaces(keyword, { limit = 5 } = {}) {
      return new Promise((resolve) => {
        placesService.keywordSearch(keyword, (data, status) => {
          if (status !== STATUS_OK || !Array.isArray(data)) {
            resolve([]);
            return;
          }

          resolve(
            data.slice(0, limit).map((place) => ({
              place_name: place.place_name,
              road_address_name: place.road_address_name || '',
              address_name: place.address_name || '',
              y: String(place.y),
              x: String(place.x),
            }))
          );
        });
      });
    },
    setHighlightBounds(sw, ne) {
      if (highlightRect) highlightRect.setMap(null);
      highlightRect = new window.kakao.maps.Rectangle({
        bounds: new window.kakao.maps.LatLngBounds(
          new window.kakao.maps.LatLng(sw.lat, sw.lng),
          new window.kakao.maps.LatLng(ne.lat, ne.lng)
        ),
        strokeWeight: 2,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        fillColor: '#3B82F6',
        fillOpacity: 0.3,
      });
      highlightRect.setMap(map);
    },
    setPoints(points, { onSelect, selectedPointId } = {}) {
      pointMarkers.forEach((marker) => marker.setMap(null));
      pointMarkers = points.map((point) => {
        const marker = new window.kakao.maps.Marker({
          map,
          position: new window.kakao.maps.LatLng(point.coordinates.lat, point.coordinates.lng),
          title: point.name,
        });

        if (typeof marker.setZIndex === 'function') {
          marker.setZIndex(point.id === selectedPointId ? 10 : 1);
        }

        if (typeof onSelect === 'function') {
          window.kakao.maps.event.addListener(marker, 'click', () => onSelect(point.id));
        }

        return marker;
      });
    },
  };
}

async function tryCreateOpenStreetMapController(options) {
  try {
    await ensureLeafletLoaded(options);
    const geocoder = await resolveOpenGeocoderOptions(options);
    return { ok: true, controller: createOpenStreetMapController({ ...options, openGeocoder: geocoder }), geocoder };
  } catch (error) {
    console.error('OpenStreetMap fallback failed:', error);
    return { ok: false, reason: 'open-map-load-failed' };
  }
}

async function resolveOpenGeocoderOptions(options = {}) {
  const runtimeConfig = await loadRuntimeConfig({
    windowConfig: options.windowConfig,
    appBaseUrl: options.appBaseUrl,
    runtimeConfigPaths: options.runtimeConfigPaths || DEFAULT_RUNTIME_CONFIG_PATHS,
  });

  const params = new URLSearchParams(options.search || window.location.search);
  const searchMode = getTrimmedString(params.get('geocoder') || params.get('open_geocoder'));
  const requestedMode = (searchMode || options.env?.VITE_OPEN_GEOCODER_MODE || options.windowConfig?.openGeocoderMode || runtimeConfig.openGeocoderMode || 'auto')
    .trim()
    .toLowerCase();
  const normalizedMode = OPEN_GEOCODER_MODES.has(requestedMode) ? requestedMode : 'auto';
  const baseUrl = getTrimmedString(
    options.env?.VITE_OPEN_GEOCODER_BASE_URL ||
      options.windowConfig?.openGeocoderBaseUrl ||
      runtimeConfig.openGeocoderBaseUrl ||
      DEFAULT_NOMINATIM_BASE_URL
  ) || DEFAULT_NOMINATIM_BASE_URL;
  const isLocalOrigin = window.location.protocol !== 'https:' || LOCAL_HOSTNAMES.has(window.location.hostname);
  const isDefaultPublicBase = baseUrl === DEFAULT_NOMINATIM_BASE_URL;

  const effectiveMode =
    normalizedMode === 'auto'
      ? isLocalOrigin && isDefaultPublicBase
        ? 'fallback'
        : 'direct'
      : normalizedMode;

  const notice =
    effectiveMode === 'fallback'
      ? '로컬 프리뷰에서는 공용 지오코더를 직접 호출하지 않고 좌표 안내로 대체합니다. 프록시를 설정하면 실제 검색을 다시 켤 수 있습니다.'
      : effectiveMode === 'proxy'
        ? '프록시 지오코더 경로를 사용 중입니다.'
        : '';

  return {
    mode: effectiveMode,
    baseUrl,
    isLocalOrigin,
    usesPublicNominatim: isDefaultPublicBase,
    notice,
  };
}

function createOpenStreetMapController(options = {}) {
  const leaflet = window.L;
  const openGeocoder = options.openGeocoder || {
    mode: 'direct',
    baseUrl: options.nominatimBaseUrl || DEFAULT_NOMINATIM_BASE_URL,
    usesPublicNominatim: true,
    isLocalOrigin: false,
  };
  const mapContainer = document.getElementById('map');
  const map = leaflet.map(mapContainer, {
    zoomControl: true,
    preferCanvas: true,
  });
  const initialLevel = 3;
  map.setView([37.4979, 127.0276], appLevelToLeafletZoom(initialLevel));
  leaflet
    .tileLayer(options.tileLayerUrl || DEFAULT_TILE_LAYER_URL, {
      attribution: options.tileLayerAttribution || DEFAULT_TILE_ATTRIBUTION,
      maxZoom: 19,
    })
    .addTo(map);

  let highlightRect = null;
  let suppressNextMoveStart = false;
  let pointMarkers = [];

  return {
    id: 'openstreetmap',
    label: 'OpenStreetMap',
    supportsAutocomplete: false,
    getCenter() {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng };
    },
    setCenter(lat, lng) {
      suppressNextMoveStart = true;
      map.setView([lat, lng], map.getZoom(), { animate: false });
    },
    getLevel() {
      return leafletZoomToAppLevel(map.getZoom());
    },
    setLevel(level) {
      suppressNextMoveStart = true;
      map.setZoom(appLevelToLeafletZoom(level), { animate: false });
    },
    getBounds() {
      const bounds = map.getBounds();
      return {
        sw: {
          lat: bounds.getSouthWest().lat,
          lng: bounds.getSouthWest().lng,
        },
        ne: {
          lat: bounds.getNorthEast().lat,
          lng: bounds.getNorthEast().lng,
        },
      };
    },
    project(lat, lng) {
      const point = map.latLngToContainerPoint([lat, lng]);
      return { x: point.x, y: point.y };
    },
    onIdle(handler) {
      map.on('moveend zoomend', handler);
    },
    onDragStart(handler) {
      map.on('movestart', () => {
        if (suppressNextMoveStart) {
          suppressNextMoveStart = false;
          return;
        }
        handler();
      });
    },
    async reverseGeocode(lat, lng) {
      if (openGeocoder.mode === 'fallback') {
        return buildLocalFallbackReverse(lat, lng);
      }

      const url = buildOpenGeocoderUrl(openGeocoder.baseUrl, 'reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('accept-language', document.documentElement.lang || 'ko');
      url.searchParams.set('addressdetails', '1');

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return buildLocalFallbackReverse(lat, lng);
        const data = await response.json();
        return normalizeNominatimReverse(data);
      } catch (error) {
        if (openGeocoder.isLocalOrigin && openGeocoder.usesPublicNominatim) {
          console.warn('Open geocoder direct fetch failed on local origin, using coordinate fallback instead.', error);
          return buildLocalFallbackReverse(lat, lng);
        }
        throw error;
      }
    },
    async searchPlaces(keyword, { limit = 5 } = {}) {
      if (openGeocoder.mode === 'fallback') {
        return [];
      }

      const url = buildOpenGeocoderUrl(openGeocoder.baseUrl, 'search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('q', keyword);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', document.documentElement.lang || 'ko');
      url.searchParams.set('countrycodes', 'kr');

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data.map(normalizeNominatimPlace) : [];
      } catch (error) {
        if (openGeocoder.isLocalOrigin && openGeocoder.usesPublicNominatim) {
          console.warn('Open search direct fetch failed on local origin. Configure a proxy to enable search locally.', error);
          return [];
        }
        throw error;
      }
    },
    setHighlightBounds(sw, ne) {
      if (highlightRect) highlightRect.remove();
      highlightRect = leaflet.rectangle(
        [
          [sw.lat, sw.lng],
          [ne.lat, ne.lng],
        ],
        {
          color: '#3B82F6',
          weight: 2,
          fillColor: '#3B82F6',
          fillOpacity: 0.3,
        }
      ).addTo(map);
    },
    setPoints(points, { onSelect, selectedPointId } = {}) {
      pointMarkers.forEach((marker) => marker.remove?.());
      pointMarkers = points.map((point) => {
        const isSelected = point.id === selectedPointId;
        const marker = leaflet.circleMarker
          ? leaflet.circleMarker([point.coordinates.lat, point.coordinates.lng], {
              radius: isSelected ? 9 : 7,
              color: isSelected ? '#0f766e' : '#2563eb',
              weight: 2,
              fillColor: isSelected ? '#14b8a6' : '#60a5fa',
              fillOpacity: 0.92,
            })
          : leaflet.marker([point.coordinates.lat, point.coordinates.lng]);

        marker.addTo(map);
        marker.on?.('click', () => onSelect?.(point.id));
        return marker;
      });
    },
  };
}

function normalizeNominatimPlace(item) {
  const address = item.address || {};
  const placeName = [item.name, address.amenity, address.building, address.tourism, address.shop]
    .find(Boolean) || String(item.display_name || '').split(',')[0].trim() || '검색 결과';

  return {
    place_name: placeName,
    road_address_name: buildDisplayAddress(address, item.display_name),
    address_name: item.display_name || '',
    y: String(item.lat),
    x: String(item.lon),
  };
}

function normalizeNominatimReverse(item) {
  if (!item) return null;
  const address = item.address || {};
  return {
    roadAddress: buildDisplayAddress(address, item.display_name),
    jibunAddress: item.display_name || '',
    buildingName: [address.amenity, address.building, address.tourism, address.shop, address.office].find(Boolean) || '',
  };
}

function buildLocalFallbackReverse(lat, lng) {
  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);
  const formatted = `${normalizedLat.toFixed(4)},${normalizedLng.toFixed(4)}`;

  return {
    roadAddress: `좌표 ${formatted}`,
    jibunAddress: formatted,
    buildingName: '',
  };
}

function buildOpenGeocoderUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl || DEFAULT_NOMINATIM_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return new URL(`${normalizedBase}/${normalizedPath}`);
}

function buildDisplayAddress(address, fallback = '') {
  const primary = [
    [address.road, address.house_number].filter(Boolean).join(' '),
    [address.pedestrian, address.house_number].filter(Boolean).join(' '),
    [address.footway, address.house_number].filter(Boolean).join(' '),
  ].find(Boolean);

  const locality = [address.suburb, address.city_district, address.city || address.town || address.village, address.state]
    .filter(Boolean)
    .join(' ');

  return [locality, primary].filter(Boolean).join(' ') || fallback || '';
}

function appLevelToLeafletZoom(level) {
  const numericLevel = Number.isFinite(Number(level)) ? Number(level) : 3;
  return Math.max(5, Math.min(18, 19 - numericLevel));
}

function leafletZoomToAppLevel(zoom) {
  const numericZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : appLevelToLeafletZoom(3);
  return Math.max(1, Math.min(14, 19 - numericZoom));
}

async function ensureLeafletLoaded(options) {
  if (window.L?.map) return;

  ensureExternalStylesheet({
    selector: 'link[data-leaflet-css="true"]',
    href: options.leafletCssUrl || DEFAULT_LEAFLET_CSS_URL,
    dataset: { leafletCss: 'true' },
  });

  ensureExternalScript({
    selector: 'script[data-leaflet-js="true"]',
    src: options.leafletJsUrl || DEFAULT_LEAFLET_JS_URL,
    dataset: { leafletJs: 'true' },
  });

  await waitForScriptLoad('script[data-leaflet-js="true"]', 10000);
  if (!window.L?.map) throw new Error('Leaflet failed to initialize');
}

function ensureExternalStylesheet({ selector, href, dataset = {} }) {
  const existing = document.querySelector(selector);
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  Object.entries(dataset).forEach(([key, value]) => {
    link.dataset[key] = value;
  });
  document.head.appendChild(link);
  return link;
}

function ensureExternalScript({ selector, src, dataset = {} }) {
  const existing = document.querySelector(selector);
  if (existing) {
    if (existing.src === src) return existing;
    existing.remove();
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.defer = true;
  Object.entries(dataset).forEach(([key, value]) => {
    script.dataset[key] = value;
  });
  document.head.appendChild(script);
  return script;
}

function waitForScriptLoad(selector, timeoutMs) {
  const existingScript = document.querySelector(selector);
  if (!existingScript) return Promise.reject(new Error(`Script element not found for ${selector}`));

  return new Promise((resolve, reject) => {
    if (existingScript.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Script load timeout for ${selector}`));
    }, timeoutMs);

    const onLoad = () => {
      existingScript.dataset.loaded = 'true';
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`Script failed to load for ${selector}`));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      existingScript.removeEventListener('load', onLoad);
      existingScript.removeEventListener('error', onError);
    };

    existingScript.addEventListener('load', onLoad, { once: true });
    existingScript.addEventListener('error', onError, { once: true });
  });
}

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveKakaoJsKey({ env = {}, windowConfig = {}, appBaseUrl = '/', runtimeConfigPaths = DEFAULT_RUNTIME_CONFIG_PATHS, defaultKakaoJsKey = '', defaultKakaoKeyHosts = DEFAULT_KAKAO_KEY_HOSTS }) {
  const envKey = getTrimmedString(env.VITE_KAKAO_JS_KEY);
  if (envKey) {
    return { key: envKey, source: 'vite-env' };
  }

  const runtimeConfig = await loadRuntimeConfig({ windowConfig, appBaseUrl, runtimeConfigPaths });
  const runtimeKey = getTrimmedString(runtimeConfig.kakaoJsKey);
  if (runtimeKey) {
    return { key: runtimeKey, source: runtimeConfig.source || 'runtime-config' };
  }

  if (defaultKakaoJsKey && defaultKakaoKeyHosts.has(window.location.hostname)) {
    return { key: defaultKakaoJsKey, source: 'fallback' };
  }

  return { key: '', source: 'none', reason: 'missing-kakao-key' };
}

async function loadRuntimeConfig({ windowConfig = {}, appBaseUrl = '/', runtimeConfigPaths = DEFAULT_RUNTIME_CONFIG_PATHS }) {
  const windowKey = getTrimmedString(windowConfig.kakaoJsKey);
  const windowOpenGeocoderBaseUrl = getTrimmedString(windowConfig.openGeocoderBaseUrl);
  const windowOpenGeocoderMode = getTrimmedString(windowConfig.openGeocoderMode);
  if (windowKey || windowOpenGeocoderBaseUrl || windowOpenGeocoderMode) {
    return {
      ...windowConfig,
      kakaoJsKey: windowKey,
      openGeocoderBaseUrl: windowOpenGeocoderBaseUrl,
      openGeocoderMode: windowOpenGeocoderMode,
      source: 'window-config',
    };
  }

  for (const configPath of runtimeConfigPaths) {
    const configUrl = new URL(configPath, new URL(appBaseUrl, window.location.origin));
    try {
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (response.status === 404 || !response.ok) continue;

      const config = await response.json();
      const kakaoJsKey = getTrimmedString(config.kakaoJsKey);
      const openGeocoderBaseUrl = getTrimmedString(config.openGeocoderBaseUrl);
      const openGeocoderMode = getTrimmedString(config.openGeocoderMode);
      if (kakaoJsKey || openGeocoderBaseUrl || openGeocoderMode) {
        return {
          ...config,
          kakaoJsKey,
          openGeocoderBaseUrl,
          openGeocoderMode,
          source: configPath,
        };
      }
    } catch (error) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn(`Failed to load runtime config from ${configPath}:`, error);
      }
    }
  }

  return {
    kakaoJsKey: '',
    openGeocoderBaseUrl: '',
    openGeocoderMode: '',
    source: 'none',
  };
}

function getKakaoSdkUrl(kakaoJsKey) {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoJsKey)}&libraries=services&autoload=false`;
}

function waitForKakaoMapsLoad() {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(new Error('Kakao maps loader unavailable'));
      return;
    }
    window.kakao.maps.load(resolve);
  });
}

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
