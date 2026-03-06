import { describe, expect, it } from 'vitest';
import { createGilmaruResolver, generateSentence, latLngToGilmaru } from '../gilmaru_engine.js';
import { sampleWordA, sampleWordB, sampleWordC, sampleWordD, sampleWordGroups } from '../samples/public-word-pack.js';

const resolver = createGilmaruResolver(sampleWordGroups, {
    incompleteAddressMessage: '샘플 주소를 확인하세요'
});

describe('Gilmaru engine', () => {
    it('should convert coordinates into a stable Gilmaru code', () => {
        const result = latLngToGilmaru(37.4979, 127.0276, 1);
        expect(result.code).toMatch(/^A\d{3}\.B\d{3}\.C\d{3}\.D\d{3}$/);
        expect(result.gridSize).toBe(0.0001);
    });

    it('should resolve words from injected groups', () => {
        const words = resolver.getWordsFromCode('A001.B001.C001.D001');
        expect(words).toEqual([sampleWordA[0], sampleWordB[0], sampleWordC[0], sampleWordD[0]]);
    });

    it('should resolve a full address from injected groups', () => {
        expect(resolver.fullAddress('A001.B001.C001.D001')).toBe('봄날 안개 하늘 설렘');
    });

    it('should return fallback values for invalid or incomplete codes', () => {
        expect(resolver.getWordFromCode('A999')).toBe('???');
        expect(resolver.getWordsFromCode('A001.B001')).toEqual([]);
        expect(resolver.fullAddress('A001.B001')).toBe('샘플 주소를 확인하세요');
    });

    it('should produce deterministic sentence templates', () => {
        const words = ['바람', '마을', '정원', '노을'];
        expect(generateSentence(words, 7)).toBe(generateSentence(words, 7));
    });
});
