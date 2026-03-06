# 길마루 (Gilmaru)

길마루는 지도 좌표를 4개의 한글 단어 주소로 표현하는 웹앱입니다.
이 공개 저장소에는 실제 앱 코드, 단어 데이터, 생성 스크립트, 테스트, 공개
프로젝트 문서가 함께 들어갑니다.

## 포함 범위

- 실제 앱 런타임: `app.js`, `gilmaru_core.js`, `word_data.js`
- 순수 엔진: `gilmaru_engine.js`
- 실제 단어 데이터와 생성 파이프라인: `*.csv`, `*.txt`, `*.py`
- 테스트: Vitest + Playwright
- PWA 구성과 정적 자산
- 공익 오픈소스 전환 문서

## 빠른 시작

```bash
npm install
npm run dev
```

선택 설정:

- `VITE_KAKAO_JS_KEY`
- `VITE_MAP_PROVIDER` (`auto` or `open`)
- `gilmaru.config.local.json`

예시 파일:

- `.env.example`
- `gilmaru.config.local.example.json`

## 테스트와 빌드

```bash
npm run validate:data
npm run test -- --run
npm run test:e2e
npm run build
```

## 라이선스 구조

- 코드와 스크립트: `AGPL-3.0-or-later`
- 단어 데이터: `ODbL-1.0`
- 문서: `CC BY-SA 4.0`

자세한 내용:

- [LICENSE](./LICENSE)
- [NOTICE](./NOTICE)
- [TRADEMARKS.md](./TRADEMARKS.md)
- [코드 라이선스 안내](./docs/licenses/code.md)
- [데이터 라이선스 안내](./docs/licenses/data.md)
- [문서 라이선스 안내](./docs/licenses/docs.md)

## 문서

- [공익 오픈소스 선언문](./docs/public-good-manifesto.md)
- [오픈 라이선스 전략](./docs/open-license-strategy.md)
- [권리관계 표](./docs/rights-inventory.md)
- [커뮤니티 로드맵](./docs/community-roadmap.md)
- [공개 구조 메모](./docs/public-release-structure.md)
- [포인트 팩 기여 가이드](./docs/data-contribution-guide.md)
- [포인트 팩 스키마](./docs/point-pack-spec.md)

## 커뮤니티 운영

- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [SECURITY.md](./SECURITY.md)
- [SUPPORT.md](./SUPPORT.md)

## 주의

- Kakao Maps JavaScript SDK와 Places는 별도 약관과 도메인 등록 조건이 있습니다.
- 현재 공개 전환은 저장소 작성물과 추적 데이터 전체를 대상으로 하지만,
  외부 서비스 약관은 그대로 존중해야 합니다.
