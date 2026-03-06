import { wordA, wordB, wordC, wordD } from './word_data.js';
import { createGilmaruResolver, generateSentence, latLngToGilmaru } from './gilmaru_engine.js';

const resolver = createGilmaruResolver(
    {
        A: wordA,
        B: wordB,
        C: wordC,
        D: wordD
    },
    {
        incompleteAddressMessage: '확대해서 확인하세요'
    }
);

export { generateSentence, latLngToGilmaru };
export const { fullAddress, getWordsFromCode, getWordFromCode } = resolver;
