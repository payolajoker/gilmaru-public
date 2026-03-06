import { wordA, wordB, wordC, wordD } from './word_data.js';
import { latLngToGilmaru, getWordsFromCode, generateSentence, fullAddress } from './gilmaru_core.js';

let map;
let canvas, ctx;
let geocoder;
let currentPlaceName = null;
let currentRoadAddress = null;
let activeModal = null;
let lastFocusedElement = null;
let searchActiveIndex = -1;

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
const KAKAO_SDK_MAX_RETRIES = 1;
const KAKAO_SDK_TIMEOUT_MS = 10000;
const SERVICE_WORKER_URL = new URL('sw.js', new URL(APP_BASE_URL, window.location.origin));
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

/* Initialization */
document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();

    const sdkResult = await loadKakaoMapSdk();
    if (!sdkResult.ok) {
        handleMapLoadFailure(sdkResult.reason);
        return;
    }
    if (sdkResult.keySource === 'fallback') {
        console.info('Using bundled Kakao JS key fallback. Set VITE_KAKAO_JS_KEY to override it per environment.');
    }

    initMap();
    initEventListeners();
    setTimeout(initDeepLink, 1000); // Small delay to ensure map is ready
});

async function loadKakaoMapSdk() {
    if (window.kakao?.maps?.services) return { ok: true, keySource: 'preloaded' };

    const keyResolution = await resolveKakaoJsKey();
    if (!keyResolution.key) {
        return { ok: false, reason: keyResolution.reason };
    }

    for (let attempt = 0; attempt <= KAKAO_SDK_MAX_RETRIES; attempt += 1) {
        try {
            ensureKakaoScriptTag(getKakaoSdkUrl(keyResolution.key));
            await waitForKakaoScriptLoad();
            await waitForKakaoMapsLoad();
            return { ok: Boolean(window.kakao?.maps?.services), keySource: keyResolution.source };
        } catch (error) {
            console.error(`Kakao SDK load failed (attempt ${attempt + 1}):`, error);
            const staleScript = document.querySelector('script[data-kakao-sdk="true"]');
            if (staleScript) staleScript.remove();
            if (attempt === KAKAO_SDK_MAX_RETRIES) return { ok: false, reason: 'sdk-load-failed' };
            await waitForMs(700);
        }
    }
    return { ok: false, reason: 'sdk-load-failed' };
}

function getTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function resolveKakaoJsKey() {
    const envKey = getTrimmedString(ENV.VITE_KAKAO_JS_KEY);
    if (envKey) {
        return { key: envKey, source: 'vite-env' };
    }

    const runtimeConfig = await loadRuntimeConfig();
    const runtimeKey = getTrimmedString(runtimeConfig.kakaoJsKey);
    if (runtimeKey) {
        return { key: runtimeKey, source: runtimeConfig.source || 'runtime-config' };
    }

    if (DEFAULT_KAKAO_KEY_HOSTS.has(window.location.hostname)) {
        return { key: DEFAULT_KAKAO_JS_KEY, source: 'fallback' };
    }

    return { key: '', source: 'none', reason: 'missing-kakao-key' };
}

async function loadRuntimeConfig() {
    const windowKey = getTrimmedString(WINDOW_CONFIG.kakaoJsKey);
    if (windowKey) {
        return { kakaoJsKey: windowKey, source: 'window-config' };
    }

    for (const configPath of RUNTIME_CONFIG_PATHS) {
        const configUrl = new URL(configPath, new URL(APP_BASE_URL, window.location.origin));
        try {
            const response = await fetch(configUrl, { cache: 'no-store' });
            if (response.status === 404) continue;
            if (!response.ok) continue;

            const config = await response.json();
            const kakaoJsKey = getTrimmedString(config.kakaoJsKey);
            if (kakaoJsKey) {
                return { kakaoJsKey, source: configPath };
            }
        } catch (error) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn(`Failed to load runtime config from ${configPath}:`, error);
            }
        }
    }

    return { kakaoJsKey: '', source: 'none' };
}

function getKakaoSdkUrl(kakaoJsKey) {
    return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoJsKey)}&libraries=services&autoload=false`;
}

function ensureKakaoScriptTag(src) {
    const existingScript = document.querySelector('script[data-kakao-sdk="true"]');
    if (existingScript) {
        if (existingScript.src === src) return;
        existingScript.remove();
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.kakaoSdk = 'true';
    document.head.appendChild(script);
}

function waitForKakaoScriptLoad() {
    if (window.kakao?.maps?.load) return Promise.resolve();

    const scriptEl = document.querySelector('script[data-kakao-sdk="true"]');
    if (!scriptEl) return Promise.reject(new Error('Kakao SDK script element not found'));

    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error('Kakao SDK load timeout'));
        }, KAKAO_SDK_TIMEOUT_MS);

        const onLoad = () => {
            cleanup();
            resolve();
        };

        const onError = () => {
            cleanup();
            reject(new Error('Kakao SDK failed to load'));
        };

        const cleanup = () => {
            window.clearTimeout(timer);
            scriptEl.removeEventListener('load', onLoad);
            scriptEl.removeEventListener('error', onError);
        };

        scriptEl.addEventListener('load', onLoad, { once: true });
        scriptEl.addEventListener('error', onError, { once: true });
    });
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

function handleMapLoadFailure(reason = 'sdk-load-failed') {
    const addressEl = document.getElementById('address-text');
    const sentenceEl = document.getElementById('sentence-text');
    const roadEl = document.getElementById('road-address');
    const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
    const mapContainer = document.getElementById('map');
    const mapOption = {
        center: new kakao.maps.LatLng(37.4979, 127.0276), // Gangnam Station
        level: 3 // Start a bit closer
    };
    map = new kakao.maps.Map(mapContainer, mapOption);

    // Init Geocoder
    geocoder = new kakao.maps.services.Geocoder();
    placesService = new kakao.maps.services.Places();

    // Initial Updates
    resizeCanvasToMap();
    updateCenterAddress();

    // Map Events
    kakao.maps.event.addListener(map, 'idle', () => {
        try {
            updateCenterAddress();
            updateZoomDisplay();
        } catch (e) {
            console.error("Idle update failed", e);
        }
    });

    // Reset place name and address on manual move
    kakao.maps.event.addListener(map, 'dragstart', () => {
        currentPlaceName = null;
        currentRoadAddress = null;
    });
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

/* QR Code Logic */
function showQRCode() {
    const qrModal = document.getElementById('qr-modal');
    const center = map.getCenter();
    const gilmaru = latLngToGilmaru(center.getLat(), center.getLng(), 1); // Force precision level 1

    // Updates
    const words = getWordsFromCode(gilmaru.code);

    // HTML with Highlight
    const highlightedWords = words.map(w => `<span class="highlight-word">${w}</span>`).join(" ");
    document.getElementById('qr-gilmaru-text').innerHTML = highlightedWords;

    // Road Address Logic
    const roadTxt = document.getElementById('qr-road-address-text');

    // 1. Try existing data
    if (currentRoadAddress || currentPlaceName) {
        roadTxt.innerText = currentRoadAddress || currentPlaceName;
    } else {
        // 2. Fetch if missing
        roadTxt.innerText = "주소 정보를 불러오는 중...";
        geocoder.coord2Address(center.getLng(), center.getLat(), (result, status) => {
            if (status === kakao.maps.services.Status.OK) {
                const detail = result[0];
                const addr = (detail.road_address ? detail.road_address.address_name : "") ||
                    (detail.address ? detail.address.address_name : "주소 정보 없음");
                roadTxt.innerText = addr;
            } else {
                roadTxt.innerText = "주소 정보 없음";
            }
        });
    }

    // URL to share
    const link = `${window.location.origin}${window.location.pathname}?code=${gilmaru.code}`;

    // Generate QR
    const qrContainer = document.getElementById('qr-code-display');
    qrContainer.innerHTML = ""; // Clear prev
    new QRCode(qrContainer, {
        text: link,
        width: 140,
        height: 140,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

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

function saveQRImage() {
    const element = document.getElementById('qr-card-container');

    html2canvas(element, {
        scale: 2, // High resolution
        backgroundColor: null, // Transparent background handled by element CSS
        logging: false,
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `gilmaru-card-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }).catch(err => {
        console.error("Image save failed:", err);
        alert("이미지 저장 중 오류가 발생했습니다.");
    });
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
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const projection = map.getProjection();

    const originLat = 33.0;
    const originLng = 124.6;
    const subBlockSize = 0.0001;

    // Optimization: Only draw lines within view
    const startX = Math.floor((sw.getLng() - originLng) / subBlockSize);
    const endX = Math.floor((ne.getLng() - originLng) / subBlockSize);
    const startY = Math.floor((sw.getLat() - originLat) / subBlockSize);
    const endY = Math.floor((ne.getLat() - originLat) / subBlockSize);

    // Limit calculation to avoid freezing if zoomed out too much (safety check)
    if ((endX - startX) * (endY - startY) > 5000) return;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x++) {
        const lng = originLng + x * subBlockSize;
        const p1 = projection.containerPointFromCoords(new kakao.maps.LatLng(sw.getLat(), lng));
        const p2 = projection.containerPointFromCoords(new kakao.maps.LatLng(ne.getLat(), lng));
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y++) {
        const lat = originLat + y * subBlockSize;
        const p1 = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, sw.getLng()));
        const p2 = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, ne.getLng()));
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    ctx.stroke();
}

function updateCenterAddress() {
    try {
        const center = map.getCenter();
        const level = map.getLevel();
        const gilmaru = latLngToGilmaru(center.getLat(), center.getLng(), level);

        // 1. Gilmaru Address
        const addressText = fullAddress(gilmaru.code);
        const addressEl = document.getElementById('address-text');
        if (addressEl) {
            addressEl.innerHTML = `${addressText} <span class="material-icons copy-icon">content_copy</span>`;
        }

        // 1.5 Sentence Address (Mnemonic)
        const words = getWordsFromCode(gilmaru.code);
        // Safety check if word data is missing
        if (!words || words.some(w => w === "???" || w === undefined)) {
            console.warn("Word data missing or undefined:", words);
        }

        const sentence = generateSentence(words, gilmaru.x + gilmaru.y);
        const sentenceEl = document.getElementById('sentence-text');
        if (sentenceEl) {
            sentenceEl.innerHTML = `"${sentence}"`;
        }

        // 2. Real Address & Place Name (Reverse Geocoding)
        updateDetailAddress(center.getLat(), center.getLng());

        drawHighlightGrid(center.getLat(), center.getLng());
        drawCanvasGrid(); // Redraw grid on move

        // 3. Update Browser URL (Deep Link Sync)
        // Update the URL without reloading page so users can copy/share immediately
        const newUrl = `${window.location.pathname}?code=${gilmaru.code}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

    } catch (e) {
        console.error("Critical Error in updateCenterAddress:", e);
    }
}

function updateDetailAddress(lat, lng) {
    const placeEl = document.getElementById('place-name');
    const roadEl = document.getElementById('road-address');

    // If we have a searched road address, use it directly (Priority 1)
    if (currentRoadAddress) {
        roadEl.textContent = currentRoadAddress;
        if (currentPlaceName) {
            placeEl.textContent = currentPlaceName;
            placeEl.style.display = "block";
        }
        return; // Skip reverse geocoding to avoid overwriting with less accurate data
    }

    geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
            const detail = result[0];
            const roadAddr = detail.road_address ? detail.road_address.address_name : "";
            const jibunAddr = detail.address ? detail.address.address_name : "";
            const buildingName = detail.road_address && detail.road_address.building_name ? detail.road_address.building_name : "";

            // Display Address (Priority: Road > Jibun)
            // User requested Road Address strongly.
            const displayAddr = roadAddr || jibunAddr;
            roadEl.textContent = displayAddr;

            // Display Place Name priorities:
            // 1. Searched Place Name (currentPlaceName)
            // 2. Building Name from Geocoder
            // 3. Region Name (if no building) - Optional, maybe too generic.

            let displayPlace = currentPlaceName || buildingName;

            if (displayPlace) {
                placeEl.textContent = displayPlace;
                placeEl.style.display = "block";
            } else {
                placeEl.style.display = "none";
            }
        } else {
            roadEl.textContent = "";
            placeEl.style.display = "none";
        }
    });
}

/* Highlight current 10m box */
function drawHighlightGrid(lat, lng) {
    if (window.highlightRect) window.highlightRect.setMap(null);

    const originLon = 124.6;
    const originLat = 33.0;
    const gridSize = 0.0001; // 10m

    const x = Math.floor((lng - originLon) / gridSize);
    const y = Math.floor((lat - originLat) / gridSize);

    const swLatLng = new kakao.maps.LatLng(originLat + y * gridSize, originLon + x * gridSize);
    const neLatLng = new kakao.maps.LatLng(originLat + (y + 1) * gridSize, originLon + (x + 1) * gridSize);

    window.highlightRect = new kakao.maps.Rectangle({
        bounds: new kakao.maps.LatLngBounds(swLatLng, neLatLng),
        strokeWeight: 2,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        fillColor: '#3B82F6',
        fillOpacity: 0.3
    });
    window.highlightRect.setMap(map);
}

function updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `Zoom: ${map.getLevel()}`;
}

/* Feature: Search */
function handleSearch() {
    const keyword = document.getElementById('search-input').value.trim();
    if (!keyword) return;

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
    return keyword.length > 1 && !keyword.includes('.') && !parseGilmaruAddress(keyword);
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
let placesService;

function handleAutocomplete(keyword) {
    if (!placesService) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        const searchBox = document.querySelector('.search-box');
        searchInput.setAttribute('aria-busy', 'true');
        if (searchBox) searchBox.classList.add('is-loading');

        placesService.keywordSearch(keyword, (data, status) => {
            const resultsDiv = document.getElementById('search-results');

            if (status === kakao.maps.services.Status.OK && data.length > 0) {
                resultsDiv.innerHTML = '';
                data.slice(0, 5).forEach((place, index) => {
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
                updateSearchStatus(`검색 결과 ${Math.min(data.length, 5)}건`);
            } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
                resultsDiv.innerHTML = '<div class="search-item-empty" role="presentation">검색 결과가 없습니다.</div>';
                resultsDiv.style.display = 'block';
                clearSearchSelection();
                setSearchExpanded(true);
                updateSearchStatus('검색 결과가 없습니다.');
            } else {
                hideSearchResults();
                updateSearchStatus('검색 결과를 불러오지 못했습니다.');
            }

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

    currentPlaceName = name;
    currentRoadAddress = addr;

    map.setCenter(new kakao.maps.LatLng(lat, lng));
    map.setLevel(2);
    showToast(`'${name}'(으)로 이동했습니다.`);
}

// Event delegation for search results
document.getElementById('search-results').addEventListener('click', (e) => {
    const item = e.target.closest('.search-item[role="option"]');
    selectSearchItem(item);
});

function searchPlaces(keyword) {
    if (!placesService) {
        showToast("검색 서비스를 불러오지 못했습니다.");
        return;
    }

    placesService.keywordSearch(keyword, (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
            const place = data[0]; // Take first result
            currentPlaceName = place.place_name;
            currentRoadAddress = place.road_address_name || place.address_name;

            const moveLatLon = new kakao.maps.LatLng(place.y, place.x);
            map.setCenter(moveLatLon);
            map.setLevel(2);
            showToast(`'${place.place_name}'(으)로 이동했습니다.`);
        } else {
            showToast("장소를 찾을 수 없습니다.");
        }
    });
}

function resolveGilmaruAddress(address, isSilent = false, parsedAddress = null) {
    const resolvedIndexes = parsedAddress || parseGilmaruAddress(address);
    if (!resolvedIndexes) {
        if (!isSilent) showToast("잘못된 길마루 주소 형식입니다.");
        return false;
    }

    const originLon = 124.6;
    const originLat = 33.0;
    const subBlockSize = 0.0001;

    const finalX = resolvedIndexes.A * 500 + resolvedIndexes.C;
    const finalY = resolvedIndexes.B * 500 + resolvedIndexes.D;

    const lat = originLat + finalY * subBlockSize + (subBlockSize / 2); // Center of grid
    const lng = originLon + finalX * subBlockSize + (subBlockSize / 2);

    map.setCenter(new kakao.maps.LatLng(lat, lng));
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
            currentPlaceName = null;
            currentRoadAddress = null;
            map.setCenter(new kakao.maps.LatLng(lat, lon));
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
    const addressNode = document.getElementById('address-text').firstChild;
    const addressText = addressNode ? addressNode.textContent.trim() : "";

    // addressText is "Word Word Word Word" (space separated)
    // Convert to dot separated for unique URL param
    if (!addressText || addressText === "로딩중..." || addressText.includes("확대해서")) {
        // Fallback to calculation if text is not ready
        const center = map.getCenter();
        const gilmaru = latLngToGilmaru(center.getLat(), center.getLng(), 1);
        return `${window.location.href.split('?')[0]}?code=${getWordsFromCode(gilmaru.code).join(".")}`;
    }

    // Replace spaces with dots for URL code
    const wordString = addressText.split(" ").join(".");
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?code=${encodeURIComponent(wordString)}`;
}
function copyAddressToClipboard() {
    // Only copy the 4 words as requested
    const addressNode = document.getElementById('address-text').firstChild;
    const addressText = addressNode ? addressNode.textContent.trim() : "";

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
