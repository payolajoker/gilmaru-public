# 공개 저장소 추출 구조

이 문서는 메인 작업 저장소에서 실제 공개 저장소 후보를 추출하는 현재 구조를 설명한다.

전제:

- `2026-03-07` 기준으로 유지보수자가 현재 추적 중인 단어 데이터와 생성 산출물이 합법적으로 공개 가능하다고 확인했다.

## 1. 현재 원칙

`public-release/`는 더 이상 축소판이 아니다.

지금은 아래를 포함하는 `실제 공개 저장소 후보`를 만든다.

- 앱 런타임 코드
- 단어 데이터
- 단어 생성 스크립트와 원천/중간 산출물
- 테스트와 빌드 도구
- 라이선스/공지/상표 문서
- 공익 오픈소스 문서

계속 제외하는 것은 `로컬 상태`와 `기계별 산출물`이다.

예:

- `node_modules/`
- `dist/`
- `test-results/`
- `gilmaru.config.local.json`
- `public-release/`, `public-release-template/`

## 2. 생성 방식

[scripts/prepare-public-release.cjs](/D:/payolajoker_git/gilmaru/scripts/prepare-public-release.cjs#L1)가 메인 저장소의 tracked 파일과 공개용 추가 메타 파일을 묶어서 `public-release/`를 다시 만든다.

핵심 포함 대상:

- [app.js](/D:/payolajoker_git/gilmaru/app.js)
- [gilmaru_core.js](/D:/payolajoker_git/gilmaru/gilmaru_core.js)
- [gilmaru_engine.js](/D:/payolajoker_git/gilmaru/gilmaru_engine.js)
- [word_data.js](/D:/payolajoker_git/gilmaru/word_data.js)
- [topik_vocabulary_combined.csv](/D:/payolajoker_git/gilmaru/topik_vocabulary_combined.csv)
- [mecab_nng.csv](/D:/payolajoker_git/gilmaru/mecab_nng.csv)
- [mecab_nnp.csv](/D:/payolajoker_git/gilmaru/mecab_nnp.csv)
- [mecab_va.csv](/D:/payolajoker_git/gilmaru/mecab_va.csv)
- [test/core.test.js](/D:/payolajoker_git/gilmaru/test/core.test.js)
- [test/e2e/smoke.spec.js](/D:/payolajoker_git/gilmaru/test/e2e/smoke.spec.js)

추가 공개 메타:

- [LICENSE](/D:/payolajoker_git/gilmaru/LICENSE)
- [NOTICE](/D:/payolajoker_git/gilmaru/NOTICE)
- [TRADEMARKS.md](/D:/payolajoker_git/gilmaru/TRADEMARKS.md)
- [docs/licenses/code.md](/D:/payolajoker_git/gilmaru/docs/licenses/code.md)
- [docs/licenses/data.md](/D:/payolajoker_git/gilmaru/docs/licenses/data.md)
- [docs/licenses/docs.md](/D:/payolajoker_git/gilmaru/docs/licenses/docs.md)

## 3. 운영 규칙

- 공개 저장소 후보는 `public-release/`를 기준으로 검증한다.
- 메인 저장소는 계속 작업용 저장소로 남을 수 있다.
- 공개 저장소는 별도 Git 원격으로 운영한다.
