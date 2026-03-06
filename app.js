import { wordA, wordB, wordC, wordD } from './word_data.js';
import { latLngToGilmaru, getWordsFromCode, generateSentence, fullAddress } from './gilmaru_core.js';
import { createMapController } from './map-provider.js';

let map;
let canvas, ctx;
let currentPlaceName = null;
let currentRoadAddress = null;
let activeModal = null;
let lastFocusedElement = null;
let searchActiveIndex = -1;
let mapProviderInfo = null;
let detailRequestToken = 0;

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

    const mapResult = await createMapController({
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
    setTimeout(initDeepLink, 1000); // Small delay to ensure map is ready
});

function updateProviderStatus() {
    document.body.dataset.mapProvider = mapProviderInfo?.id || 'unknown';
    const versionEl = document.getElementById('app-version');
    if (!versionEl || !mapProviderInfo) return;

    const suffix = mapProviderInfo.id === 'openstreetmap'
        ? ' · OpenStreetMap public mode'
        : '';
    versionEl.textContent = `Gilmaru v1.7.7${suffix}`;
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
        updateDetailAddress(center.lat, center.lng);

        drawHighlightGrid(center.lat, center.lng);
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
    const requestToken = ++detailRequestToken;

    // If we have a searched road address, use it directly (Priority 1)
    if (currentRoadAddress) {
        roadEl.textContent = currentRoadAddress;
        if (currentPlaceName) {
            placeEl.textContent = currentPlaceName;
            placeEl.style.display = "block";
        } else {
            placeEl.style.display = "none";
        }
        return; // Skip reverse geocoding to avoid overwriting with less accurate data
    }

    map.reverseGeocode(lat, lng).then((detail) => {
        if (requestToken !== detailRequestToken || currentRoadAddress) return;

        if (!detail) {
            roadEl.textContent = "";
            placeEl.style.display = "none";
            return;
        }

        const displayAddr = detail.roadAddress || detail.jibunAddress || "";
        roadEl.textContent = displayAddr;

        const displayPlace = currentPlaceName || detail.buildingName;
        if (displayPlace) {
            placeEl.textContent = displayPlace;
            placeEl.style.display = "block";
        } else {
            placeEl.style.display = "none";
        }
    }).catch(() => {
        if (requestToken !== detailRequestToken || currentRoadAddress) return;
        roadEl.textContent = "";
        placeEl.style.display = "none";
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
    try {
        const data = await map.searchPlaces(keyword, { limit: 1 });
        if (data.length === 0) {
            showToast("No place found.");
            return;
        }

        const place = data[0];
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
    const addressNode = document.getElementById('address-text').firstChild;
    const addressText = addressNode ? addressNode.textContent.trim() : "";

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
