const DEFAULT_GROUP_ORDER = ['A', 'B', 'C', 'D'];

export function latLngToGilmaru(lat, lng, level) {
    const originLon = 124.6;
    const originLat = 33.0;
    const blockSize = 0.05;
    const subBlockSize = 0.0001;

    const x = Math.floor((lng - originLon) / blockSize);
    const y = Math.floor((lat - originLat) / blockSize);

    const codeX = `A${String(x + 1).padStart(3, '0')}`;
    const codeY = `B${String(y + 1).padStart(3, '0')}`;

    let modLng = (lng - originLon) % blockSize;
    if (modLng < 0) modLng += blockSize;

    let modLat = (lat - originLat) % blockSize;
    if (modLat < 0) modLat += blockSize;

    const innerX = Math.min(Math.floor(modLng / subBlockSize), 499);
    const innerY = Math.min(Math.floor(modLat / subBlockSize), 499);

    const codeC = `C${String(innerX + 1).padStart(3, '0')}`;
    const codeD = `D${String(innerY + 1).padStart(3, '0')}`;

    return {
        code: `${codeX}.${codeY}.${codeC}.${codeD}`,
        x: x * 500 + innerX,
        y: y * 500 + innerY,
        gridSize: subBlockSize
    };
}

export function generateSentence(words, seed) {
    if (words.length < 4) return '';

    const shuffledIdx = [0, 1, 2, 3];
    let randomVal = seed;

    const seededRandom = () => {
        randomVal = (randomVal * 9301 + 49297) % 233280;
        return randomVal / 233280;
    };

    for (let index = shuffledIdx.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(seededRandom() * (index + 1));
        [shuffledIdx[index], shuffledIdx[randomIndex]] = [shuffledIdx[randomIndex], shuffledIdx[index]];
    }

    const shuffledWords = shuffledIdx.map((index) => words[index]);
    const highlightWord = (word) => `<span class="highlight-word">${escapeHtml(word)}</span>`;
    const templateIndex = Math.floor(seededRandom() * 5);
    const [word1, word2, word3, word4] = shuffledWords;

    if (templateIndex === 0) {
        return `${highlightWord(word1)}${getJosa(word1, 'iga')} ${highlightWord(word2)}에서 ${highlightWord(word3)}${getJosa(word3, 'wagwa')} ${highlightWord(word4)}`;
    }

    if (templateIndex === 1) {
        return `${highlightWord(word1)}${getJosa(word1, 'eunneun')} ${highlightWord(word2)}, ${highlightWord(word3)} 그리고 ${highlightWord(word4)}`;
    }

    if (templateIndex === 2) {
        return `${highlightWord(word1)}${getJosa(word1, 'wagwa')} ${highlightWord(word2)}의 ${highlightWord(word3)}, ${highlightWord(word4)}`;
    }

    if (templateIndex === 3) {
        return `${highlightWord(word1)}, ${highlightWord(word2)}${getJosa(word2, 'irang')} ${highlightWord(word3)}에서 ${highlightWord(word4)}`;
    }

    return `${highlightWord(word1)}${getJosa(word1, 'iga')} ${highlightWord(word2)}${getJosa(word2, 'eulreul')} 만나 ${highlightWord(word3)}${getJosa(word3, 'wagwa')} ${highlightWord(word4)}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function createGilmaruResolver(wordGroups, options = {}) {
    const groups = normalizeWordGroups(wordGroups);
    const unknownWord = options.unknownWord ?? '???';
    const incompleteAddressMessage = options.incompleteAddressMessage ?? '확대해서 확인하세요';

    function getWordFromCode(code) {
        if (!code || typeof code !== 'string') return unknownWord;

        const prefix = code[0];
        const number = Number.parseInt(code.slice(1), 10) - 1;
        const words = groups[prefix];

        if (!Number.isInteger(number) || !words) return unknownWord;
        return words[number] || unknownWord;
    }

    function getWordsFromCode(code) {
        const parts = splitGilmaruCode(code);
        if (!parts) return [];
        return parts.map(getWordFromCode);
    }

    function fullAddress(code) {
        const parts = splitGilmaruCode(code);
        if (!parts) return incompleteAddressMessage;
        return parts.map(getWordFromCode).join(' ');
    }

    return {
        wordGroups: groups,
        getWordFromCode,
        getWordsFromCode,
        fullAddress
    };
}

function normalizeWordGroups(wordGroups) {
    const normalized = {};

    DEFAULT_GROUP_ORDER.forEach((group) => {
        const words = wordGroups?.[group];
        normalized[group] = Array.isArray(words) ? words : [];
    });

    return normalized;
}

function splitGilmaruCode(code) {
    if (!code || typeof code !== 'string') return null;

    const parts = code.split('.');
    if (parts.length < DEFAULT_GROUP_ORDER.length) return null;
    return parts.slice(0, DEFAULT_GROUP_ORDER.length);
}

function hasJongseong(word) {
    if (!word) return false;

    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xac00 || lastChar > 0xd7a3) return false;

    return (lastChar - 0xac00) % 28 > 0;
}

function getJosa(word, type) {
    const has = hasJongseong(word);

    if (type === 'iga') return has ? '이' : '가';
    if (type === 'eunneun') return has ? '은' : '는';
    if (type === 'eulreul') return has ? '을' : '를';
    if (type === 'wagwa') return has ? '과' : '와';
    if (type === 'irang') return has ? '이랑' : '랑';

    return '';
}
