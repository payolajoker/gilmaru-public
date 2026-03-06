import { createGilmaruResolver, generateSentence, latLngToGilmaru } from './gilmaru_engine.js';
import { sampleWordGroups } from './sample_word_pack.js';

const resolver = createGilmaruResolver(sampleWordGroups, {
  incompleteAddressMessage: '샘플 코드 4개를 모두 입력하세요'
});

const groupLabels = {
  A: 'A 그룹',
  B: 'B 그룹',
  C: 'C 그룹',
  D: 'D 그룹'
};

document.addEventListener('DOMContentLoaded', () => {
  const coordsForm = document.querySelector('#coords-form');
  const lookupForm = document.querySelector('#lookup-form');

  renderPackGroups();
  updateGeneratedPreview(37.5665, 126.9780);
  updateLookupPreview('A001.B001.C001.D001');

  coordsForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const lat = Number.parseFloat(document.querySelector('#lat-input')?.value ?? '');
    const lng = Number.parseFloat(document.querySelector('#lng-input')?.value ?? '');

    updateGeneratedPreview(lat, lng);
  });

  lookupForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const code = document.querySelector('#code-input')?.value?.trim() ?? '';
    updateLookupPreview(code);
  });
});

function updateGeneratedPreview(lat, lng) {
  const generatedCode = document.querySelector('#generated-code');
  const generatedSampleCode = document.querySelector('#generated-sample-code');
  const generatedAddress = document.querySelector('#generated-address');
  const generatedSentence = document.querySelector('#generated-sentence');

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    generatedCode.textContent = '입력 오류';
    generatedSampleCode.textContent = '샘플 alias를 만들 수 없습니다.';
    generatedAddress.textContent = '위도와 경도를 숫자로 넣어주세요.';
    generatedSentence.textContent = '샘플 엔진은 숫자 좌표만 처리합니다.';
    return;
  }

  const result = latLngToGilmaru(lat, lng, 1);
  const sampleCode = normalizeCodeForSamplePack(result.code);
  const words = resolver.getWordsFromCode(sampleCode);

  generatedCode.textContent = result.code;
  generatedSampleCode.textContent = `샘플 alias ${sampleCode}`;
  generatedAddress.textContent = resolver.fullAddress(sampleCode);
  generatedSentence.innerHTML = generateSentence(words, result.x + result.y);
}

function updateLookupPreview(code) {
  const resolvedWords = document.querySelector('#resolved-words');
  const resolvedAddress = document.querySelector('#resolved-address');
  const words = resolver.getWordsFromCode(code);

  resolvedWords.innerHTML = '';

  if (!words.length) {
    resolvedWords.textContent = '샘플 코드 4개를 모두 입력하세요';
    resolvedAddress.textContent = resolver.fullAddress(code);
    return;
  }

  words.forEach((word) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = word;
    resolvedWords.append(chip);
  });

  resolvedAddress.textContent = resolver.fullAddress(code);
}

function renderPackGroups() {
  const container = document.querySelector('#pack-groups');
  if (!container) return;

  Object.entries(sampleWordGroups).forEach(([groupKey, words]) => {
    const section = document.createElement('section');
    section.className = 'pack-group';

    const heading = document.createElement('h3');
    heading.textContent = `${groupLabels[groupKey]} · ${words.length}개`;

    const chipRow = document.createElement('p');
    words.forEach((word) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = word;
      chipRow.append(chip);
    });

    section.append(heading, chipRow);
    container.append(section);
  });
}

function normalizeCodeForSamplePack(code) {
  const parts = code.split('.');
  const normalized = parts.map((part) => {
    const prefix = part[0];
    const group = sampleWordGroups[prefix];
    const rawIndex = Math.max(Number.parseInt(part.slice(1), 10) - 1, 0);
    const nextIndex = (rawIndex % group.length) + 1;
    return `${prefix}${String(nextIndex).padStart(3, '0')}`;
  });

  return normalized.join('.');
}
