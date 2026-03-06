import { wordA, wordB, wordC, wordD } from './word_data.js';
import { latLngToGilmaru, getWordsFromCode, generateSentence, fullAddress } from './gilmaru_core.js';
import { createMapController } from './map-provider.js';
import { validatePointPack } from './point-pack-validator.js';

let map;
let canvas, ctx;
let currentPlaceName = null;
let currentRoadAddress = null;
let activeModal = null;
let lastFocusedElement = null;
let searchActiveIndex = -1;
let mapProviderInfo = null;
let detailRequestToken = 0;
let activePointPack = null;
let activePointPackSource = '';
let selectedPointId = null;
let easyGuidanceMode = false;
let highContrastMode = false;
let largeTextMode = false;
let restoredSnapshot = null;
const runtimeScriptPromises = new Map();

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

const SEARCH_ITEM_SELECTOR = '#search-results .search-item[role="option"]';
const initialDeepLinkCode = new URLSearchParams(window.location.search).get('code');
const DEFAULT_KAKAO_JS_KEY = 'c2db0ea3cf94c9b50e56b5883f54537a';
const DEFAULT_KAKAO_KEY_HOSTS = new Set(['payolajoker.github.io']);
const ENV = import.meta.env || {};
const WINDOW_CONFIG = window.__GILMARU_CONFIG__ || {};
const APP_BASE_URL = ENV.BASE_URL || new URL('./', window.location.href).pathname;
const RUNTIME_CONFIG_PATHS = ['gilmaru.config.local.json', 'gilmaru.config.json'];
const SERVICE_WORKER_URL = new URL('sw.js', new URL(APP_BASE_URL, window.location.origin));
const SAMPLE_POINT_PACK_URL = new URL(
    './data/point-packs/examples/gangnam-station-access-pack.json',
    import.meta.url
).toString();
const QRCODE_RUNTIME_URL = new URL('./vendor/qrcode.min.js', import.meta.url).toString();
const HTML2CANVAS_RUNTIME_URL = new URL('./vendor/html2canvas.min.js', import.meta.url).toString();
const STORAGE_KEYS = {
    mapProviderPreference: 'gilmaru.mapProviderPreference',
    contrastMode: 'gilmaru.contrastMode',
    textScale: 'gilmaru.textScale',
    lastSnapshot: 'gilmaru.lastSnapshot'
};
const PROVIDER_PREFERENCES = new Set(['auto', 'kakao', 'open']);
const GILMARU_GROUPS = ['A', 'B', 'C', 'D'];
const GILMARU_WORD_GROUPS = {
    A: wordA,
    B: wordB,
    C: wordC,
    D: wordD
};
const GILMARU_WORD_LOOKUPS = Object.fromEntries(
    Object.entries(GILMARU_WORD_GROUPS).map(([group, words]) => [
        group,
        new Map(words.map((word, index) => [word, index]))
    ])
);
const POINT_TYPE_LABELS = {
    entrance: '입구',
    accessible_parking: '장애인 주차',
    ramp: '경사로',
    elevator: '엘리베이터',
    accessible_restroom: '무장애 화장실',
    rest_area: '쉼터',
    meeting_point: '집결지',
    info_desk: '안내 데스크',
    transit_stop: '정류장',
    quiet_room: '조용한 공간'
};
const POINT_STATUS_LABELS = {
    verified: '현장 확인',
    reported: '제보됨',
    temporary: '임시 운영',
    inactive: '현재 미운영'
};

/* Initialization */
document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();
    restoreCachedSnapshot();
    restoreAppearancePreferences();
    applyAppearancePreferences();
    syncProviderPreferenceUI();
    updateConnectivityStatus(false);
    bindConnectivityListeners();

    const mapResult = await createMapController({
        search: buildProviderAwareSearch(),
        env: ENV,
        windowConfig: WINDOW_CONFIG,
        appBaseUrl: APP_BASE_URL,
        runtimeConfigPaths: RUNTIME_CONFIG_PATHS,
        defaultKakaoJsKey: DEFAULT_KAKAO_JS_KEY,
        defaultKakaoKeyHosts: DEFAULT_KAKAO_KEY_HOSTS
    });

    if (!mapResult.ok) {
        handleMapLoadFailure(mapResult.reason);
        return;
    }

    map = mapResult.controller;
    mapProviderInfo = mapResult.providerInfo;
    updateProviderStatus();
    if (mapProviderInfo?.notice) {
        console.info(mapProviderInfo.notice);
    }

    initMap();
    initEventListeners();
    applyGuidanceMode();
    renderPointPackUI();
    setTimeout(initDeepLink, 1000); // Small delay to ensure map is ready
});

function updateProviderStatus() {
    document.body.dataset.mapProvider = mapProviderInfo?.id || 'unknown';
    const versionEl = document.getElementById('app-version');
    const providerStatusEl = document.getElementById('provider-status-text');
    const providerPreference = getEffectiveProviderPreference();
    syncProviderPreferenceUI();

    if (providerStatusEl) {
        if (!mapProviderInfo) {
            providerStatusEl.textContent = '지도 공급자를 준비 중입니다.';
        } else {
            const modeLabel = providerPreference === 'auto' ? '자동 선택' : '직접 선택';
            const geocoderLabel = mapProviderInfo.geocoderMode === 'fallback'
                ? ' · 로컬 좌표 안내'
                : mapProviderInfo.geocoderMode === 'proxy'
                    ? ' · 프록시 지오코더'
                    : '';
            providerStatusEl.textContent = `현재 지도: ${mapProviderInfo.label} · ${modeLabel}${geocoderLabel}`;
        }
    }

    if (!versionEl || !mapProviderInfo) return;

    const suffix = mapProviderInfo.id === 'openstreetmap'
        ? ' · OpenStreetMap public mode'
        : '';
    versionEl.textContent = `Gilmaru v1.7.13${suffix}`;
}

function safeStorageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        console.warn('localStorage read failed:', error);
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn('localStorage write failed:', error);
    }
}

function safeStorageRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.warn('localStorage remove failed:', error);
    }
}

function normalizeProviderPreference(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return PROVIDER_PREFERENCES.has(normalized) ? normalized : 'auto';
}

function getExplicitProviderPreference() {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('provider') || params.get('map') || '';
    return explicit ? normalizeProviderPreference(explicit) : '';
}

function getStoredProviderPreference() {
    return normalizeProviderPreference(
        safeStorageGet(STORAGE_KEYS.mapProviderPreference) ||
        WINDOW_CONFIG.mapProviderPreference ||
        ENV.VITE_MAP_PROVIDER ||
        'auto'
    );
}

function getEffectiveProviderPreference() {
    return getExplicitProviderPreference() || getStoredProviderPreference() || 'auto';
}

function buildProviderAwareSearch() {
    const currentUrl = new URL(window.location.href);
    const explicitPreference = getExplicitProviderPreference();
    if (explicitPreference) {
        return currentUrl.search;
    }

    const storedPreference = getStoredProviderPreference();
    if (storedPreference === 'auto') {
        currentUrl.searchParams.delete('provider');
        currentUrl.searchParams.delete('map');
        return currentUrl.search;
    }

    currentUrl.searchParams.set('provider', storedPreference);
    return currentUrl.search;
}

function syncProviderPreferenceUI() {
    const activePreference = getEffectiveProviderPreference();
    document.body.dataset.mapProviderPreference = activePreference;

    document.querySelectorAll('[data-provider-preference]').forEach((button) => {
        const isActive = button.dataset.providerPreference === activePreference;
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function setProviderPreference(preference) {
    const normalized = normalizeProviderPreference(preference);
    const currentEffectivePreference = getEffectiveProviderPreference();
    const currentStoredPreference = getStoredProviderPreference();

    if (normalized === currentEffectivePreference && normalized === currentStoredPreference) {
        syncProviderPreferenceUI();
        return;
    }

    if (normalized === 'auto') {
        safeStorageRemove(STORAGE_KEYS.mapProviderPreference);
    } else {
        safeStorageSet(STORAGE_KEYS.mapProviderPreference, normalized);
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('map');
    if (normalized === 'auto') {
        nextUrl.searchParams.delete('provider');
    } else {
        nextUrl.searchParams.set('provider', normalized);
    }
    window.location.assign(nextUrl.toString());
}

function restoreAppearancePreferences() {
    highContrastMode = safeStorageGet(STORAGE_KEYS.contrastMode) === 'high';
    largeTextMode = safeStorageGet(STORAGE_KEYS.textScale) === 'large';
}

function applyAppearancePreferences() {
    document.body.dataset.contrastMode = highContrastMode ? 'high' : 'default';
    document.body.dataset.textScale = largeTextMode ? 'large' : 'default';

    const contrastButton = document.getElementById('btn-toggle-contrast');
    const largeTextButton = document.getElementById('btn-toggle-large-text');

    if (contrastButton) {
        contrastButton.setAttribute('aria-pressed', String(highContrastMode));
        contrastButton.textContent = highContrastMode ? '고대비 켜짐' : '고대비';
    }

    if (largeTextButton) {
        largeTextButton.setAttribute('aria-pressed', String(largeTextMode));
        largeTextButton.textContent = largeTextMode ? '큰 글씨 켜짐' : '큰 글씨';
    }
}

function toggleHighContrastMode() {
    highContrastMode = !highContrastMode;
    safeStorageSet(STORAGE_KEYS.contrastMode, highContrastMode ? 'high' : 'default');
    applyAppearancePreferences();
    showToast(highContrastMode ? '고대비 모드를 켰습니다.' : '고대비 모드를 껐습니다.');
}

function toggleLargeTextMode() {
    largeTextMode = !largeTextMode;
    safeStorageSet(STORAGE_KEYS.textScale, largeTextMode ? 'large' : 'default');
    applyAppearancePreferences();
    showToast(largeTextMode ? '큰 글씨 모드를 켰습니다.' : '큰 글씨 모드를 껐습니다.');
}

function bindConnectivityListeners() {
    window.addEventListener('online', () => updateConnectivityStatus(true));
    window.addEventListener('offline', () => updateConnectivityStatus(true));
}

function updateConnectivityStatus(announce = false) {
    const isOnline = navigator.onLine !== false;
    const banner = document.getElementById('connectivity-banner');

    document.body.dataset.connectivity = isOnline ? 'online' : 'offline';
    if (!banner) return;

    if (isOnline) {
        banner.hidden = true;
        banner.textContent = '';
        if (announce) {
            showToast('온라인 상태로 돌아왔습니다.');
        }
        return;
    }

    const hasSnapshot = Boolean(restoredSnapshot?.addressText);
    banner.textContent = hasSnapshot
        ? '오프라인 상태입니다. 마지막으로 본 주소와 캐시된 화면만 사용할 수 있습니다.'
        : '오프라인 상태입니다. 캐시된 화면만 볼 수 있고 새 검색은 제한될 수 있습니다.';
    banner.hidden = false;

    if (announce) {
        showToast('오프라인 상태입니다.');
    }
}

function getCurrentAddressText() {
    const addressNode = document.getElementById('address-text')?.firstChild;
    return addressNode?.textContent?.trim() || '';
}

function renderAddressText(addressText) {
    const addressEl = document.getElementById('address-text');
    if (!addressEl) return;
    addressEl.innerHTML = `${escapeHtml(addressText)} ${getIconMarkup('copy', 'copy-icon')}`;
}

function getIconMarkup(iconName, extraClassName = '') {
    const classes = ['icon'];
    if (extraClassName) classes.push(extraClassName);
    return `<svg class="${classes.join(' ')}" aria-hidden="true" focusable="false"><use href="#icon-${escapeHtml(iconName)}"></use></svg>`;
}

function loadExternalRuntime({ key, src, globalName }) {
    if (window[globalName]) {
        return Promise.resolve(window[globalName]);
    }

    if (runtimeScriptPromises.has(key)) {
        return runtimeScriptPromises.get(key);
    }

    const promise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[data-runtime-key="${key}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(window[globalName]), { once: true });
            existingScript.addEventListener('error', () => reject(new Error(`Runtime load failed: ${key}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.runtimeKey = key;
        script.onload = () => resolve(window[globalName]);
        script.onerror = () => reject(new Error(`Runtime load failed: ${key}`));
        document.head.appendChild(script);
    });

    runtimeScriptPromises.set(key, promise);
    return promise;
}

function loadQRCodeRuntime() {
    return loadExternalRuntime({
        key: 'qrcode',
        src: QRCODE_RUNTIME_URL,
        globalName: 'QRCode'
    });
}

function loadHtml2CanvasRuntime() {
    return loadExternalRuntime({
        key: 'html2canvas',
        src: HTML2CANVAS_RUNTIME_URL,
        globalName: 'html2canvas'
    });
}

function setBusyState(element, isBusy, label) {
    if (!element) return;

    element.classList.toggle('is-busy', isBusy);
    element.disabled = isBusy;

    if (label) {
        if (!element.dataset.idleLabel) {
            element.dataset.idleLabel = element.textContent.trim();
        }
        element.setAttribute('aria-label', isBusy ? label : element.dataset.idleLabel || element.getAttribute('aria-label') || '');
    }
}

function renderSentenceText(sentence, options = {}) {
    const sentenceEl = document.getElementById('sentence-text');
    if (sentenceEl) {
        const { isHtml = true } = options;
        if (!sentence) {
            sentenceEl.textContent = '';
            return;
        }

        if (isHtml) {
            sentenceEl.innerHTML = `"${sentence}"`;
            return;
        }

        sentenceEl.textContent = `"${sentence}"`;
    }
}

function renderRoadAndPlace(roadAddress = '', placeName = '') {
    const roadEl = document.getElementById('road-address');
    const placeEl = document.getElementById('place-name');

    if (roadEl) {
        roadEl.textContent = roadAddress;
    }

    if (!placeEl) return;

    if (placeName) {
        placeEl.textContent = placeName;
        placeEl.style.display = 'block';
    } else {
        placeEl.textContent = '';
        placeEl.style.display = 'none';
    }
}

function persistSnapshot(code = '') {
    const addressText = getCurrentAddressText();
    if (!addressText) return;

    const snapshot = {
        code,
        addressText,
        sentence: document.getElementById('sentence-text')?.textContent?.trim() || '',
        sentenceHtml: document.getElementById('sentence-text')?.innerHTML?.trim() || '',
        roadAddress: currentRoadAddress || document.getElementById('road-address')?.textContent?.trim() || '',
        placeName: currentPlaceName || document.getElementById('place-name')?.textContent?.trim() || '',
        timestamp: new Date().toISOString()
    };

    restoredSnapshot = snapshot;
    safeStorageSet(STORAGE_KEYS.lastSnapshot, JSON.stringify(snapshot));
}

function restoreCachedSnapshot() {
    const raw = safeStorageGet(STORAGE_KEYS.lastSnapshot);
    if (!raw) return;

    try {
        const snapshot = JSON.parse(raw);
        if (!snapshot || typeof snapshot.addressText !== 'string' || !snapshot.addressText.trim()) {
            return;
        }

        restoredSnapshot = snapshot;
        renderAddressText(snapshot.addressText.trim());
        renderSentenceText(snapshot.sentenceHtml || snapshot.sentence || '', { isHtml: Boolean(snapshot.sentenceHtml) });
        renderRoadAndPlace(snapshot.roadAddress || '', snapshot.placeName || '');
    } catch (error) {
        console.warn('Cached snapshot restore failed:', error);
    }
}

function handleMapLoadFailure(reason = 'sdk-load-failed') {
    const addressEl = document.getElementById('address-text');
    const sentenceEl = document.getElementById('sentence-text');
    const roadEl = document.getElementById('road-address');
    const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasRestoredSnapshot = Boolean(restoredSnapshot?.addressText);

    if (hasRestoredSnapshot && navigator.onLine === false) {
        renderAddressText(restoredSnapshot.addressText);
        renderSentenceText(restoredSnapshot.sentenceHtml || restoredSnapshot.sentence || '', { isHtml: Boolean(restoredSnapshot.sentenceHtml) });
        renderRoadAndPlace(restoredSnapshot.roadAddress || '', restoredSnapshot.placeName || '');
        showToast('오프라인이라 마지막으로 본 주소를 보여줍니다.');
        return;
    }

    if (reason === 'missing-kakao-key') {
        if (addressEl) addressEl.textContent = '카카오 키 필요';
        if (sentenceEl) sentenceEl.textContent = '로컬 개발에서는 VITE_KAKAO_JS_KEY 또는 gilmaru.config.local.json 설정이 필요합니다.';
        if (roadEl) roadEl.textContent = `${window.location.origin} 를 Kakao Developers 웹 플랫폼 도메인에 등록하세요.`;
        console.error('Kakao JavaScript key is not configured for this origin. Set VITE_KAKAO_JS_KEY or gilmaru.config.local.json and register the origin in Kakao Developers > App > Platform > Web.');
        showToast('카카오 JavaScript 키 설정이 필요합니다.');
        return;
    }

    if (isLocalOrigin) {
        if (addressEl) addressEl.textContent = '카카오 도메인 확인';
        if (sentenceEl) sentenceEl.textContent = '현재 Kakao JavaScript 키가 이 로컬 주소에서 승인되지 않았습니다.';
        if (roadEl) roadEl.textContent = `${window.location.origin} 를 Kakao Developers 웹 플랫폼 도메인에 등록하세요.`;
        showToast('카카오 JavaScript 키 또는 도메인 설정을 확인하세요.');
        return;
    }

    if (addressEl) addressEl.textContent = '지도 로드 실패';
    if (sentenceEl) sentenceEl.textContent = '네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
    if (roadEl) roadEl.textContent = '';
    showToast('지도를 불러오지 못했습니다.');
}

function initDeepLink() {
    const code = initialDeepLinkCode;
    if (code && code !== "undefined" && code !== "null" && code.trim() !== "") {
        // e.g. code="반달.자리.앞날.하루"
        // Silent mode: don't show error toast on initial load
        resolveGilmaruAddress(code, true);
    }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: APP_BASE_URL })
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, (err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

function initMap() {
    // Initial Updates
    resizeCanvasToMap();
    updateCenterAddress();

    // Map Events
    map.onIdle(() => {
        try {
            updateCenterAddress();
            updateZoomDisplay();
        } catch (e) {
            console.error("Idle update failed", e);
        }
    });

    // Reset place name and address on manual move
    map.onDragStart(() => {
        currentPlaceName = null;
        currentRoadAddress = null;
        clearSelectedPoint();
    });
    if (mapProviderInfo?.notice) {
        showToast(mapProviderInfo.notice);
    }
    updateZoomDisplay();
}

function initCanvas() {
    canvas = document.getElementById('grid-canvas');
    ctx = canvas.getContext('2d');

    // Handle Window Resize
    window.addEventListener('resize', () => {
        resizeCanvasToMap();
        drawCanvasGrid();
    });
}

function initEventListeners() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (shouldAutocompleteQuery(val)) {
            handleAutocomplete(val);
        } else {
            hideSearchResults();
        }
    });

    // Hide results on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSearchResults();
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        const resultsDiv = document.getElementById('search-results');
        const items = getSearchItems();
        const isResultsOpen = resultsDiv.style.display !== 'none';

        if (e.key === 'ArrowDown' && items.length > 0 && isResultsOpen) {
            e.preventDefault();
            setActiveSearchItem(searchActiveIndex + 1);
        } else if (e.key === 'ArrowUp' && items.length > 0 && isResultsOpen) {
            e.preventDefault();
            setActiveSearchItem(searchActiveIndex - 1);
        } else if (e.key === 'Enter') {
            const activeItem = searchActiveIndex >= 0 ? items[searchActiveIndex] : null;
            if (activeItem && isResultsOpen) {
                e.preventDefault();
                activeItem.click();
            } else {
                hideSearchResults();
                handleSearch();
            }
        } else if (e.key === 'Escape') {
            if (isResultsOpen) {
                e.preventDefault();
                hideSearchResults();
            }
        } else if (e.key === 'Tab' && isResultsOpen) {
            hideSearchResults();
        }
    });

    // Search Button
    document.querySelector('.search-btn').addEventListener('click', handleSearch);

    // My Location
    document.getElementById('btn-my-location').addEventListener('click', moveToMyLocation);

    // Copy Address
    document.getElementById('address-text').addEventListener('click', copyAddressToClipboard);

    // Share Button
    document.getElementById('btn-share').addEventListener('click', shareAddress);

    // Copy Button (Secondary action)
    document.getElementById('btn-copy').addEventListener('click', copyAddressToClipboard);

    // Intro Modal
    const modal = document.getElementById('intro-modal');
    document.getElementById('btn-intro').addEventListener('click', () => {
        openModal(modal, { display: 'flex', initialFocusSelector: '#btn-close-intro' });
    });
    document.getElementById('btn-close-intro').addEventListener('click', () => {
        closeModal(modal);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });

    // QR Modal
    const qrModal = document.getElementById('qr-modal');
    document.getElementById('btn-qr').addEventListener('click', showQRCode);
    document.getElementById('btn-close-qr').addEventListener('click', () => {
        closeModal(qrModal);
    });
    document.getElementById('btn-save-image').addEventListener('click', saveQRImage);
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) closeModal(qrModal);
    });

    document.getElementById('btn-toggle-guidance').addEventListener('click', toggleEasyGuidanceMode);
    document.getElementById('btn-toggle-contrast').addEventListener('click', toggleHighContrastMode);
    document.getElementById('btn-toggle-large-text').addEventListener('click', toggleLargeTextMode);
    document.querySelectorAll('[data-provider-preference]').forEach((button) => {
        button.addEventListener('click', () => {
            setProviderPreference(button.dataset.providerPreference);
        });
    });
    document.getElementById('btn-load-sample-pack').addEventListener('click', () => {
        loadPointPackFromUrl(SAMPLE_POINT_PACK_URL, '샘플 팩');
    });
    document.getElementById('btn-import-pack').addEventListener('click', () => {
        document.getElementById('point-pack-input').click();
    });
    document.getElementById('point-pack-input').addEventListener('change', handlePointPackFileSelection);
    document.getElementById('btn-clear-point-pack').addEventListener('click', () => {
        clearPointPack();
    });
    document.getElementById('point-pack-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-point-id]');
        if (!button) return;
        selectPointById(button.dataset.pointId);
    });

    // Global modal keyboard interactions
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !activeModal && !isTextInputTarget(e.target)) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
            return;
        }

        if (!activeModal || !isModalOpen(activeModal)) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal(activeModal);
            return;
        }

        if (e.key === 'Tab') {
            trapFocus(e, activeModal);
        }
    });
}

function toggleEasyGuidanceMode() {
    easyGuidanceMode = !easyGuidanceMode;
    applyGuidanceMode();
    renderPointPackUI();
    showToast(easyGuidanceMode ? '쉬운 안내를 켰습니다.' : '쉬운 안내를 껐습니다.');
}

function applyGuidanceMode() {
    document.body.dataset.guidanceMode = easyGuidanceMode ? 'easy' : 'default';

    const toggleButton = document.getElementById('btn-toggle-guidance');
    const addressLabel = document.getElementById('address-label');
    const addressHint = document.getElementById('address-hint');
    const searchInput = document.getElementById('search-input');

    toggleButton.setAttribute('aria-pressed', String(easyGuidanceMode));
    toggleButton.textContent = easyGuidanceMode ? '쉬운 안내 켜짐' : '쉬운 안내';
    addressLabel.textContent = easyGuidanceMode ? '지금 보는 4단어 주소' : '현재 위치의 길마루 주소';
    addressHint.textContent = easyGuidanceMode ? '주소를 눌러 복사하세요.' : '주소를 누르면 복사됩니다.';
    searchInput.placeholder = easyGuidanceMode
        ? '장소 이름이나 4단어 주소를 찾으세요'
        : '장소 또는 길마루 주소 검색 (예: 강남역)';

    if (searchInput) {
        const basePlaceholder = easyGuidanceMode
            ? '장소 이름이나 4단어 주소를 찾으세요'
            : '장소 또는 길마루 주소 검색 (예: 강남역)';
        searchInput.placeholder = mapProviderInfo?.supportsAutocomplete === false
            ? `${basePlaceholder} · Enter로 검색`
            : basePlaceholder;
    }

    renderGuidancePanel();
}

function renderGuidancePanel() {
    const panel = document.getElementById('guidance-panel');
    if (!easyGuidanceMode) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
    }

    const selectedPoint = getSelectedPoint();
    const title = selectedPoint ? '지점 안내' : '사용 순서';
    const steps = selectedPoint
        ? [
            `${selectedPoint.name} 지점을 골랐습니다.`,
            '지도가 이 지점 중심으로 이동합니다.',
            '복사 또는 공유를 눌러 같이 가는 사람에게 보내세요.'
        ]
        : [
            '지도를 움직이거나 장소를 검색합니다.',
            '아래 4단어 주소를 확인합니다.',
            '복사 또는 공유를 눌러 바로 보냅니다.'
        ];

    panel.innerHTML = `
        <div class="guidance-panel-title">${escapeHtml(title)}</div>
        <ol class="guidance-panel-steps">
            ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
    `;
    panel.hidden = false;
}

async function loadPointPackFromUrl(url, sourceLabel = '샘플 팩') {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const pack = await response.json();
        applyImportedPointPack(pack, sourceLabel);
    } catch (error) {
        console.error('Failed to load point pack:', error);
        showToast('포인트 팩을 불러오지 못했습니다.');
    }
}

async function handlePointPackFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        applyImportedPointPack(parsed, file.name);
    } catch (error) {
        console.error('Point pack import failed:', error);
        showToast('포인트 팩 파일을 읽지 못했습니다.');
    } finally {
        event.target.value = '';
    }
}

function applyImportedPointPack(pack, sourceLabel) {
    const validationErrors = validatePointPack(pack);
    if (validationErrors.length > 0) {
        console.warn('Point pack validation failed:', validationErrors);
        showToast('포인트 팩 검증에 실패했습니다.');
        return;
    }

    const normalizedPack = normalizePointPack(pack);
    if (!normalizedPack) {
        showToast('포인트 팩 형식이 올바르지 않습니다.');
        return;
    }

    activePointPack = normalizedPack;
    activePointPackSource = sourceLabel;
    selectPointById(normalizedPack.points[0]?.id, {
        center: true,
        announce: false,
        preservePack: true
    });
    renderPointPackUI();
    syncPointMarkers();
    showToast(`${normalizedPack.name} 팩을 불러왔습니다.`);
}

function normalizePointPack(pack) {
    if (!pack || !Array.isArray(pack.points)) return null;

    const points = pack.points
        .map(normalizePoint)
        .filter(Boolean);

    if (points.length === 0) return null;

    return {
        packId: typeof pack.packId === 'string' && pack.packId.trim() ? pack.packId.trim() : `pack-${Date.now()}`,
        name: typeof pack.name === 'string' && pack.name.trim() ? pack.name.trim() : '이름 없는 포인트 팩',
        summary: typeof pack.summary === 'string' ? pack.summary.trim() : '',
        points
    };
}

function normalizePoint(point) {
    const lat = Number(point?.coordinates?.lat);
    const lng = Number(point?.coordinates?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const id = typeof point.id === 'string' && point.id.trim()
        ? point.id.trim()
        : `point-${Math.random().toString(36).slice(2, 10)}`;

    return {
        id,
        type: typeof point.type === 'string' ? point.type.trim() : 'meeting_point',
        status: typeof point.status === 'string' ? point.status.trim() : 'reported',
        name: typeof point.name === 'string' && point.name.trim() ? point.name.trim() : '이름 없는 지점',
        description: typeof point.description === 'string' ? point.description.trim() : '',
        gilmaruCode: typeof point.gilmaruCode === 'string' ? point.gilmaruCode.trim() : '',
        accessibility: point.accessibility && typeof point.accessibility === 'object' ? point.accessibility : {},
        coordinates: { lat, lng }
    };
}

function getSelectedPoint() {
    return activePointPack?.points.find((point) => point.id === selectedPointId) || null;
}

function clearSelectedPoint(options = {}) {
    selectedPointId = null;
    currentPlaceName = null;
    if (!options.silent) {
        renderPointPackUI();
        syncPointMarkers();
    }
}

function clearPointPack() {
    activePointPack = null;
    activePointPackSource = '';
    clearSelectedPoint({ silent: true });
    renderPointPackUI();
    syncPointMarkers();
    updateDetailAddress(map.getCenter().lat, map.getCenter().lng);
    showToast('포인트 팩을 닫았습니다.');
}

function selectPointById(pointId, options = {}) {
    if (!activePointPack) return;

    const point = activePointPack.points.find((item) => item.id === pointId);
    if (!point) return;

    selectedPointId = point.id;
    currentPlaceName = point.name;
    currentRoadAddress = null;
    renderPointPackUI();
    syncPointMarkers();

    if (options.center !== false) {
        map.setCenter(point.coordinates.lat, point.coordinates.lng);
        map.setLevel(2);
    }

    if (options.announce !== false) {
        showToast(`${point.name} 지점으로 이동했습니다.`);
    }
}

function syncPointMarkers() {
    if (!map?.setPoints) return;

    map.setPoints(activePointPack?.points || [], {
        selectedPointId,
        onSelect: (pointId) => {
            selectPointById(pointId);
        }
    });
}

function renderPointPackUI() {
    const panel = document.getElementById('point-pack-panel');
    const sourceEl = document.getElementById('point-pack-source');
    const titleEl = document.getElementById('point-pack-title');
    const summaryEl = document.getElementById('point-pack-summary');
    const selectedEl = document.getElementById('point-pack-selected');
    const listEl = document.getElementById('point-pack-list');
    const clearButton = document.getElementById('btn-clear-point-pack');

    if (!activePointPack) {
        panel.hidden = true;
        selectedEl.hidden = true;
        selectedEl.innerHTML = '';
        listEl.innerHTML = '';
        clearButton.hidden = true;
        renderGuidancePanel();
        return;
    }

    panel.hidden = false;
    clearButton.hidden = false;
    sourceEl.textContent = `${activePointPackSource || '불러온 팩'} · ${activePointPack.points.length}개 지점`;
    titleEl.textContent = activePointPack.name;
    summaryEl.textContent = activePointPack.summary || '지도 위에서 지점을 고르고 복사나 공유로 함께 보낼 수 있습니다.';

    const selectedPoint = getSelectedPoint();
    if (selectedPoint) {
        const accessibilityLine = buildPointAccessibilityLine(selectedPoint);
        selectedEl.innerHTML = `
            <div class="point-pack-selected-header">
                <div class="point-pack-selected-name" id="point-pack-selected-name">${escapeHtml(selectedPoint.name)}</div>
                <div class="point-pack-selected-meta">
                    <span class="point-pack-badge type">${escapeHtml(getPointTypeLabel(selectedPoint.type))}</span>
                    <span class="point-pack-badge status status-${escapeHtml(selectedPoint.status)}">${escapeHtml(getPointStatusLabel(selectedPoint.status))}</span>
                </div>
            </div>
            ${selectedPoint.description ? `<div class="point-pack-selected-description">${escapeHtml(selectedPoint.description)}</div>` : ''}
            ${selectedPoint.gilmaruCode ? `<div class="point-pack-selected-detail">길마루 코드: ${escapeHtml(selectedPoint.gilmaruCode)}</div>` : ''}
            ${accessibilityLine ? `<div class="point-pack-selected-detail">${escapeHtml(accessibilityLine)}</div>` : ''}
            <div class="point-pack-selected-guidance" id="point-pack-selected-guidance">${escapeHtml(buildPointGuidanceText(selectedPoint))}</div>
        `;
        selectedEl.hidden = false;
    } else {
        selectedEl.hidden = true;
        selectedEl.innerHTML = '';
    }

    listEl.innerHTML = activePointPack.points.map((point) => {
        const isActive = point.id === selectedPointId;
        return `
            <button type="button" class="point-pack-item${isActive ? ' is-active' : ''}" data-point-id="${escapeHtml(point.id)}" role="listitem">
                <div class="point-pack-item-name">${escapeHtml(point.name)}</div>
                <div class="point-pack-item-meta">
                    <span class="point-pack-badge type">${escapeHtml(getPointTypeLabel(point.type))}</span>
                    <span class="point-pack-badge status status-${escapeHtml(point.status)}">${escapeHtml(getPointStatusLabel(point.status))}</span>
                </div>
                <div class="point-pack-item-detail">${escapeHtml(point.description || buildPointGuidanceText(point))}</div>
            </button>
        `;
    }).join('');

    renderGuidancePanel();
}

function buildPointAccessibilityLine(point) {
    const parts = [];
    if (point.accessibility?.stepFree === true) {
        parts.push('계단 없이 접근 가능');
    }

    if (Number.isFinite(Number(point.accessibility?.doorWidthCm))) {
        parts.push(`문 폭 약 ${Number(point.accessibility.doorWidthCm)}cm`);
    }

    if (typeof point.accessibility?.notes === 'string' && point.accessibility.notes.trim()) {
        parts.push(point.accessibility.notes.trim());
    }

    return parts.join(' · ');
}

function buildPointGuidanceText(point) {
    if (easyGuidanceMode) {
        return `${point.name} 지점을 선택하면 지도가 이 위치로 이동합니다.`;
    }

    return `${getPointTypeLabel(point.type)} 지점입니다. 선택하면 현재 주소와 함께 공유할 수 있습니다.`;
}

function getPointTypeLabel(type) {
    return POINT_TYPE_LABELS[type] || '커뮤니티 지점';
}

function getPointStatusLabel(status) {
    return POINT_STATUS_LABELS[status] || '검토 필요';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/* QR Code Logic */
async function showQRCode() {
    const qrModal = document.getElementById('qr-modal');
    const center = map.getCenter();
    const gilmaru = latLngToGilmaru(center.lat, center.lng, 1); // Force precision level 1

    const words = getWordsFromCode(gilmaru.code);
    const highlightedWords = words.map(w => `<span class="highlight-word">${w}</span>`).join(" ");
    document.getElementById('qr-gilmaru-text').innerHTML = highlightedWords;

    const roadTxt = document.getElementById('qr-road-address-text');
    if (currentRoadAddress || currentPlaceName) {
        roadTxt.innerText = currentRoadAddress || currentPlaceName;
    } else {
        roadTxt.innerText = "Loading address...";
        map.reverseGeocode(center.lat, center.lng)
            .then((detail) => {
                roadTxt.innerText = detail?.roadAddress || detail?.jibunAddress || "Address unavailable";
            })
            .catch(() => {
                roadTxt.innerText = "Address unavailable";
            });
    }

    const link = `${window.location.origin}${window.location.pathname}?code=${gilmaru.code}`;

    const qrContainer = document.getElementById('qr-code-display');
    qrContainer.innerHTML = "";
    qrContainer.dataset.qrText = link;

    try {
        const QRCodeRuntime = await loadQRCodeRuntime();
        new QRCodeRuntime(qrContainer, {
            text: link,
            width: 140,
            height: 140,
            colorDark: '#111827',
            colorLight: '#ffffff',
            correctLevel: QRCodeRuntime.CorrectLevel.H
        });
    } catch (error) {
        console.error('QR code generation failed:', error);
        qrContainer.innerHTML = '<div class="qr-fallback">QR 코드를 불러오지 못했습니다.</div>';
    }

    openModal(qrModal, { display: 'flex', initialFocusSelector: '#btn-save-image' });
}

function isModalOpen(modal) {
    return window.getComputedStyle(modal).display !== 'none';
}

function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function trapFocus(event, modal) {
    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function openModal(modal, options = {}) {
    const { display = 'flex', initialFocusSelector = '' } = options;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.style.display = display;
    modal.setAttribute('aria-hidden', 'false');
    activeModal = modal;

    const initialFocus = initialFocusSelector ? modal.querySelector(initialFocusSelector) : null;
    const fallbackFocus = modal.querySelector(FOCUSABLE_SELECTOR);
    (initialFocus || fallbackFocus || modal).focus();
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    if (activeModal === modal) activeModal = null;

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
    lastFocusedElement = null;
}

async function saveQRImage() {
    const element = document.getElementById('qr-card-container');
    const saveButton = document.getElementById('btn-save-image');
    setBusyState(saveButton, true, '이미지를 준비 중입니다.');

    try {
        const html2canvasRuntime = await loadHtml2CanvasRuntime();
        const canvas = await html2canvasRuntime(element, {
            scale: 2,
            backgroundColor: null,
            logging: false,
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `gilmaru-card-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (err) {
        console.error("Image save failed:", err);
        alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
        setBusyState(saveButton, false, '이미지를 준비 중입니다.');
    }
}

/* Core Logic: Map & Grid */
function resizeCanvasToMap() {
    const mapContainer = document.getElementById('map');
    canvas.width = mapContainer.clientWidth;
    canvas.height = mapContainer.clientHeight;
}

function drawCanvasGrid() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const level = map.getLevel();
    if (level > 5) return;

    const bounds = map.getBounds();
    const sw = bounds.sw;
    const ne = bounds.ne;

    const originLat = 33.0;
    const originLng = 124.6;
    const subBlockSize = 0.0001;

    // Optimization: Only draw lines within view
    const startX = Math.floor((sw.lng - originLng) / subBlockSize);
    const endX = Math.floor((ne.lng - originLng) / subBlockSize);
    const startY = Math.floor((sw.lat - originLat) / subBlockSize);
    const endY = Math.floor((ne.lat - originLat) / subBlockSize);

    // Limit calculation to avoid freezing if zoomed out too much (safety check)
    if ((endX - startX) * (endY - startY) > 5000) return;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x++) {
        const lng = originLng + x * subBlockSize;
        const p1 = map.project(sw.lat, lng);
        const p2 = map.project(ne.lat, lng);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y++) {
        const lat = originLat + y * subBlockSize;
        const p1 = map.project(lat, sw.lng);
        const p2 = map.project(lat, ne.lng);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    ctx.stroke();
}

function updateCenterAddress() {
    try {
        const center = map.getCenter();
        const level = map.getLevel();
        const gilmaru = latLngToGilmaru(center.lat, center.lng, level);

        // 1. Gilmaru Address
        const addressText = fullAddress(gilmaru.code);
        renderAddressText(addressText);

        // 1.5 Sentence Address (Mnemonic)
        const words = getWordsFromCode(gilmaru.code);
        // Safety check if word data is missing
        if (!words || words.some(w => w === "???" || w === undefined)) {
            console.warn("Word data missing or undefined:", words);
        }

        const sentence = generateSentence(words, gilmaru.x + gilmaru.y);
        renderSentenceText(sentence);

        // 2. Real Address & Place Name (Reverse Geocoding)
        updateDetailAddress(center.lat, center.lng);

        drawHighlightGrid(center.lat, center.lng);
        drawCanvasGrid(); // Redraw grid on move
        renderPointPackUI();
        syncPointMarkers();

        // 3. Update Browser URL (Deep Link Sync)
        // Update the URL without reloading page so users can copy/share immediately
        const newUrl = `${window.location.pathname}?code=${gilmaru.code}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        persistSnapshot(gilmaru.code);

    } catch (e) {
        console.error("Critical Error in updateCenterAddress:", e);
    }
}

function updateDetailAddress(lat, lng) {
    const requestToken = ++detailRequestToken;

    // If we have a searched road address, use it directly (Priority 1)
    if (currentRoadAddress) {
        renderRoadAndPlace(currentRoadAddress, currentPlaceName || '');
        persistSnapshot();
        return; // Skip reverse geocoding to avoid overwriting with less accurate data
    }

    map.reverseGeocode(lat, lng).then((detail) => {
        if (requestToken !== detailRequestToken || currentRoadAddress) return;

        if (!detail) {
            renderRoadAndPlace('', '');
            return;
        }

        const displayAddr = detail.roadAddress || detail.jibunAddress || "";
        const displayPlace = currentPlaceName || detail.buildingName;
        renderRoadAndPlace(displayAddr, displayPlace || '');
        persistSnapshot();
    }).catch(() => {
        if (requestToken !== detailRequestToken || currentRoadAddress) return;
        renderRoadAndPlace('', '');
    });
}

/* Highlight current 10m box */
function drawHighlightGrid(lat, lng) {
    const originLon = 124.6;
    const originLat = 33.0;
    const gridSize = 0.0001; // 10m

    const x = Math.floor((lng - originLon) / gridSize);
    const y = Math.floor((lat - originLat) / gridSize);

    map.setHighlightBounds(
        { lat: originLat + y * gridSize, lng: originLon + x * gridSize },
        { lat: originLat + (y + 1) * gridSize, lng: originLon + (x + 1) * gridSize }
    );
}

function updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `Zoom: ${map.getLevel()}`;
}

/* Feature: Search */
function handleSearch() {
    const keyword = document.getElementById('search-input').value.trim();
    if (!keyword) return;

    clearSelectedPoint();
    const parsedGilmaruAddress = parseGilmaruAddress(keyword);
    if (keyword.includes('.') || parsedGilmaruAddress) {
        currentPlaceName = null; // Reset place name as we are navigating by coordinates
        currentRoadAddress = null;
        resolveGilmaruAddress(keyword, false, parsedGilmaruAddress);
    } else {
        searchPlaces(keyword);
    }
}

function shouldAutocompleteQuery(keyword) {
    return Boolean(map?.supportsAutocomplete) &&
        keyword.length > 1 &&
        !keyword.includes('.') &&
        !parseGilmaruAddress(keyword);
}

function parseGilmaruAddress(address) {
    const tokens = address.trim().split(/[.\s]+/).filter(Boolean);
    if (tokens.length !== 4) return null;

    return parseGilmaruCodeTokens(tokens) || parseGilmaruWordTokens(tokens);
}

function parseGilmaruCodeTokens(tokens) {
    if (!tokens.every((token) => /^[ABCD]\d{3}$/i.test(token))) return null;

    const parsedIndexes = {
        A: null,
        B: null,
        C: null,
        D: null
    };

    for (const token of tokens) {
        const group = token[0].toUpperCase();
        if (parsedIndexes[group] !== null) return null;

        const index = parseInt(token.slice(1), 10) - 1;
        if (index < 0 || index >= GILMARU_WORD_GROUPS[group].length) {
            return null;
        }
        parsedIndexes[group] = index;
    }

    return parsedIndexes;
}

function parseGilmaruWordTokens(tokens) {
    const parsedIndexes = {
        A: null,
        B: null,
        C: null,
        D: null
    };

    for (const token of tokens) {
        const match = findGilmaruWordGroup(token);
        if (!match || parsedIndexes[match.group] !== null) return null;
        parsedIndexes[match.group] = match.index;
    }

    return GILMARU_GROUPS.every((group) => parsedIndexes[group] !== null) ? parsedIndexes : null;
}

function findGilmaruWordGroup(token) {
    for (const group of GILMARU_GROUPS) {
        const index = GILMARU_WORD_LOOKUPS[group].get(token);
        if (index !== undefined) {
            return { group, index };
        }
    }
    return null;
}

// Autocomplete Logic
let debounceTimer;

function handleAutocomplete(keyword) {
    if (!map?.supportsAutocomplete) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        const searchBox = document.querySelector('.search-box');
        searchInput.setAttribute('aria-busy', 'true');
        if (searchBox) searchBox.classList.add('is-loading');

        map.searchPlaces(keyword, { limit: 5 }).then((data) => {
            const resultsDiv = document.getElementById('search-results');

            if (data.length > 0) {
                resultsDiv.innerHTML = '';
                data.forEach((place, index) => {
                    const addr = place.road_address_name || place.address_name;
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.id = `search-option-${index}`;
                    item.setAttribute('role', 'option');
                    item.setAttribute('aria-selected', 'false');
                    item.dataset.name = place.place_name;
                    item.dataset.addr = addr;
                    item.dataset.lat = place.y;
                    item.dataset.lng = place.x;

                    const titleEl = document.createElement('div');
                    titleEl.className = 'search-item-title';
                    titleEl.textContent = place.place_name;

                    const addrEl = document.createElement('div');
                    addrEl.className = 'search-item-addr';
                    addrEl.textContent = addr;

                    item.appendChild(titleEl);
                    item.appendChild(addrEl);
                    resultsDiv.appendChild(item);
                });
                resultsDiv.style.display = 'block';
                clearSearchSelection();
                setSearchExpanded(true);
                updateSearchStatus(`Search results: ${Math.min(data.length, 5)}`);
            } else {
                resultsDiv.innerHTML = '<div class="search-item-empty" role="presentation">No search results.</div>';
                resultsDiv.style.display = 'block';
                clearSearchSelection();
                setSearchExpanded(true);
                updateSearchStatus('No search results.');
            }

            searchInput.setAttribute('aria-busy', 'false');
            if (searchBox) searchBox.classList.remove('is-loading');
        }).catch((error) => {
            console.error('Autocomplete lookup failed:', error);
            hideSearchResults();
            updateSearchStatus('Could not load search results.');
            searchInput.setAttribute('aria-busy', 'false');
            if (searchBox) searchBox.classList.remove('is-loading');
        });
    }, 300);
}

function getSearchItems() {
    return Array.from(document.querySelectorAll(SEARCH_ITEM_SELECTOR));
}

function setSearchExpanded(isExpanded) {
    const searchInput = document.getElementById('search-input');
    searchInput.setAttribute('aria-expanded', String(isExpanded));
}

function updateSearchStatus(message) {
    const statusEl = document.getElementById('search-status');
    if (!statusEl) return;
    statusEl.textContent = message;
}

function clearSearchSelection() {
    const searchInput = document.getElementById('search-input');
    searchActiveIndex = -1;
    searchInput.setAttribute('aria-activedescendant', '');
    getSearchItems().forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
}

function isTextInputTarget(target) {
    return target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function hideSearchResults() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.style.display = 'none';
    clearSearchSelection();
    setSearchExpanded(false);
    const searchInput = document.getElementById('search-input');
    searchInput.setAttribute('aria-busy', 'false');
    const searchBox = document.querySelector('.search-box');
    if (searchBox) searchBox.classList.remove('is-loading');
}

function setActiveSearchItem(index) {
    const searchInput = document.getElementById('search-input');
    const items = getSearchItems();
    if (items.length === 0) {
        clearSearchSelection();
        return;
    }

    const normalizedIndex = ((index % items.length) + items.length) % items.length;
    searchActiveIndex = normalizedIndex;

    items.forEach((item, itemIndex) => {
        const isActive = itemIndex === normalizedIndex;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
    });

    const activeItem = items[normalizedIndex];
    searchInput.setAttribute('aria-activedescendant', activeItem.id);
    activeItem.scrollIntoView({ block: 'nearest' });
}

function selectSearchItem(item) {
    if (!item) return;

    const name = item.dataset.name;
    const addr = item.dataset.addr;
    const lat = parseFloat(item.dataset.lat);
    const lng = parseFloat(item.dataset.lng);

    document.getElementById('search-input').value = name;
    hideSearchResults();
    updateSearchStatus(`선택됨: ${name}`);

    clearSelectedPoint();
    currentPlaceName = name;
    currentRoadAddress = addr;

    map.setCenter(lat, lng);
    map.setLevel(2);
    showToast(`'${name}'(으)로 이동했습니다.`);
}

// Event delegation for search results
document.getElementById('search-results').addEventListener('click', (e) => {
    const item = e.target.closest('.search-item[role="option"]');
    selectSearchItem(item);
});

async function searchPlaces(keyword) {
    if (navigator.onLine === false && mapProviderInfo?.id === 'openstreetmap') {
        showToast('오프라인에서는 새 장소 검색이 제한됩니다.');
        return;
    }

    try {
        const data = await map.searchPlaces(keyword, { limit: 1 });
        if (data.length === 0) {
            if (mapProviderInfo?.id === 'openstreetmap' && mapProviderInfo?.geocoderMode === 'fallback') {
                showToast('로컬 공개 모드에서는 장소 검색이 제한됩니다. 프록시를 설정하거나 배포 URL에서 확인하세요.');
                return;
            }
            showToast("No place found.");
            return;
        }

        const place = data[0];
        clearSelectedPoint();
        currentPlaceName = place.place_name;
        currentRoadAddress = place.road_address_name || place.address_name;
        map.setCenter(Number(place.y), Number(place.x));
        map.setLevel(2);
        showToast(`Moved to '${place.place_name}'.`);
    } catch (error) {
        console.error('Place search failed:', error);
        showToast("Place search failed.");
    }
}

function resolveGilmaruAddress(address, isSilent = false, parsedAddress = null) {
    const resolvedIndexes = parsedAddress || parseGilmaruAddress(address);
    if (!resolvedIndexes) {
        if (!isSilent) showToast("잘못된 길마루 주소 형식입니다.");
        return false;
    }

    clearSelectedPoint();
    const originLon = 124.6;
    const originLat = 33.0;
    const subBlockSize = 0.0001;

    const finalX = resolvedIndexes.A * 500 + resolvedIndexes.C;
    const finalY = resolvedIndexes.B * 500 + resolvedIndexes.D;

    const lat = originLat + finalY * subBlockSize + (subBlockSize / 2); // Center of grid
    const lng = originLon + finalX * subBlockSize + (subBlockSize / 2);

    map.setCenter(lat, lng);
    map.setLevel(2);
    if (!isSilent) showToast("주소 위치로 이동했습니다.");
    return true;
}


/* Feature: My Location */
function moveToMyLocation() {
    if (navigator.geolocation) {
        // Show loading state?
        showToast("위치를 찾는 중...");
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            clearSelectedPoint();
            currentPlaceName = null;
            currentRoadAddress = null;
            map.setCenter(lat, lon);
            map.setLevel(2);
            showToast("현재 위치로 이동했습니다.");
        }, (err) => {
            console.error(err);
            showToast("위치 정보를 가져올 수 없습니다.");
        }, { enableHighAccuracy: true });
    } else {
        showToast("이 브라우저에서는 위치 서비스를 지원하지 않습니다.");
    }
}

/* Feature: Action Buttons */
function getLinkToCurrentPosition() {
    // Generate link based on CURRENTLY DISPLAYED address text
    // This ensures What You See Is What You Copy
    const addressText = getCurrentAddressText();

    // addressText is "Word Word Word Word" (space separated)
    // Convert to dot separated for unique URL param
    if (!addressText || addressText === "로딩중..." || addressText.includes("확대해서")) {
        // Fallback to calculation if text is not ready
        const center = map.getCenter();
        const gilmaru = latLngToGilmaru(center.lat, center.lng, 1);
        return `${window.location.href.split('?')[0]}?code=${getWordsFromCode(gilmaru.code).join(".")}`;
    }

    // Replace spaces with dots for URL code
    const wordString = addressText.split(" ").join(".");
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?code=${encodeURIComponent(wordString)}`;
}
function copyAddressToClipboard() {
    // Only copy the 4 words as requested
    const addressText = getCurrentAddressText();

    if (!addressText || addressText === "로딩중...") {
        showToast("주소가 로딩되지 않았습니다.");
        return;
    }

    navigator.clipboard.writeText(addressText).then(() => {
        showToast("주소가 복사되었습니다.");
    }).catch(() => {
        showToast("복사 실패");
    });
}

function shareAddress() {
    // Only share the link to the location
    const link = getLinkToCurrentPosition();

    if (navigator.share) {
        navigator.share({
            title: '길마루 주소',
            url: link
        }).then(() => console.log('Shared')).catch((error) => console.log('Sharing failed', error));
    } else {
        // Fallback: Copy Link
        navigator.clipboard.writeText(link).then(() => {
            showToast("링크가 복사되었습니다.");
        }).catch(() => {
            showToast("복사 실패");
        });
    }
}

/* UI Helper: Toast */
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.className = "show";
    setTimeout(function () { toast.className = toast.className.replace("show", ""); }, 3000);
}
