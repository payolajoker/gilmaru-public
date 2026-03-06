# 길마루 권리관계 표 초안

이 문서는 길마루 저장소를 공익 오픈소스 프로젝트로 전환하기 전에, 어떤 자산을 바로 공개할 수 있고 어떤 자산은 보류해야 하는지 정리한 `초기 권리관계 표`다.

중요:

- 이 문서는 `법률 자문`이 아니다.
- 판단 기준은 `2026-03-06` 기준 로컬 저장소와 `git ls-files`로 확인된 추적 파일이다.
- `.gitignore`에 걸리는 로컬 산출물과 미추적 파일은 본문 맨 아래 별도 메모로만 다룬다.
- 출처나 허가가 문서화되지 않은 자산은 보수적으로 `미확인` 또는 `보류`로 처리한다.
- `2026-03-07` 기준으로 유지보수자가 현재 추적 중인 단어 데이터와 생성 산출물이 합법적으로 공개 가능하다고 확인했으며, 아래 표는 그 전제를 반영해 갱신한다.

## 1. 현재 상태 요약

현재 저장소는 권리관계상 세 부류가 섞여 있다.

### A. 비교적 명확한 1차 저작물

- 앱 코드
- 테스트 코드
- 빌드/배포 스크립트
- 대부분의 문서
- 자체 제작으로 보이는 SVG 아이콘

이 그룹은 유지보수자가 권리를 보유하고 있을 가능성이 높다.
다만 현재는 루트 `LICENSE` 파일이 없고, `package.json`의 `"license": "ISC"`만 존재한다.

### B. 외부 서비스 의존 자산

- Kakao Maps / Places 연동 코드
- jsDelivr Pretendard 웹폰트 로딩, 로컬 SVG 아이콘 스프라이트, 벤더 번들 `QRCode.js` / `html2canvas`
- `package-lock.json`에 기록된 npm 의존 패키지

이 그룹은 저장소 코드와 별개로 `업스트림 라이선스 또는 이용약관`을 따라야 한다.

### C. 외부 데이터 기반 자산

- `topik_vocabulary_combined.csv`
- `mecab_*.csv`
- 위 파일들에서 파생된 형용사/명사 목록
- 최종 단어셋과 `word_data.js`

이 그룹은 원래 가장 민감한 영역이었지만, 현재는 유지보수자 확인 전제를 반영해 공개 가능 자산으로 본다.
다만 원출처 메모와 생성 경로 문서화는 계속 유지하는 편이 좋다.

## 2. 판단 레이블

- `즉시 공개 가능(초안)`: 저장소 작성물이 명확하고 외부 권리 문제가 상대적으로 적음
- `조건부 공개`: 자체 작성물로 보이지만 외부 서비스/패키지/상표/약관 영향이 있음
- `보류`: 외부 데이터 또는 출처 미확인 자산. 라이선스 확인 전 재배포/재라이선스 금지

보충 표기:

- `즉시 공개 가능(maintainer 확인)`: 유지보수자가 공개 가능 여부를 직접 확인한 자산

## 3. 권리관계 표

| 자산 그룹 | 대표 파일/경로 | 출처 판단 | 현재 판단 | 오픈 전환 우선순위 | 메모 |
|---|---|---|---|---|---|
| 앱 본체 코드 | `app.js`, `gilmaru_core.js`, `index.html`, `style.css`, `sw.js`, `manifest.json` | 저장소 작성물로 보임 | 조건부 공개 | 높음 | 코드 자체는 1차 저작물로 보이지만, `app.js`는 Kakao SDK/Places를 런타임 로딩함 |
| 빌드/배포 설정 | `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `scripts/build-safe.cjs`, `deploy.bat` | 저장소 작성물로 보임 | 즉시 공개 가능(초안) | 높음 | 외부 패키지를 사용하지만 파일 자체는 저장소 작성물 |
| 테스트 코드 | `test/core.test.js`, `test/e2e/smoke.spec.js`, `test/e2e/fake-kakao-init.js` | 저장소 작성물로 보임 | 즉시 공개 가능(초안) | 높음 | `fake-kakao-init.js`는 업스트림 SDK 복제가 아니라 테스트용 재구현으로 보임 |
| 설정 예시/저장소 메타 | `.env.example`, `gilmaru.config.local.example.json`, `.gitignore`, `package.json` | 저장소 작성물로 보임 | 즉시 공개 가능(초안) | 중간 | `package.json`은 현재 라이선스를 `ISC`로 표기 |
| 잠정 문서 | `README.md`, `docs/*.md` | 대부분 저장소 작성물 | 즉시 공개 가능(초안) | 높음 | 문서 라이선스는 아직 별도 지정 없음 |
| 시각 자산 | `icons/icon.svg`, `generate_icons.html`, `mockup.html` | 저장소 작성물 또는 자체 생성으로 추정 | 조건부 공개 | 중간 | 외부 템플릿/AI 생성 여부 문서화가 없으므로 출처 메모 필요 |
| 백업 파일 | `app.js.bak` | 내부 백업본 | 조건부 공개 | 낮음 | 배포/오픈소스 전환 시 제외 권장 |
| npm 의존 패키지 기록 | `package-lock.json` | 외부 패키지 메타데이터 | 조건부 공개 | 중간 | 자체 라이선스 문서 대상은 아니고, 업스트림 고지/NOTICE가 필요 |
| Kakao SDK/Places 연동 | `app.js`의 Kakao SDK URL 및 지도/장소 검색 연동 | 외부 서비스 | 조건부 공개 | 높음 | Kakao 약관과 도메인 등록 조건의 영향을 받음. 저장소 코드는 공개 가능해도 SDK 자체를 재라이선스할 수는 없음 |
| 웹폰트/아이콘/유틸 런타임 | `index.html`의 Pretendard 링크, `vendor/qrcode.min.js`, `vendor/html2canvas.min.js`, 인라인 SVG 아이콘 | 외부 오픈소스/저장소 작성물 혼합 | 조건부 공개 | 중간 | 아이콘은 저장소 작성물이지만, Pretendard와 벤더 파일은 각자 고지와 업스트림 라이선스 유지가 필요 |
| TOPIK 원본 데이터 | `topik_vocabulary_combined.csv` | 외부 데이터 | 즉시 공개 가능(maintainer 확인) | 높음 | 유지보수자 확인 전제를 반영한다. 공개 저장소에 포함 가능 |
| MeCab 기반 원본 데이터 | `mecab_nng.csv`, `mecab_nnp.csv`, `mecab_va.csv` | 외부 데이터 또는 외부 사전 추출물 | 즉시 공개 가능(maintainer 확인) | 높음 | 유지보수자 확인 전제를 반영한다. 원출처 메모는 계속 가치가 있다 |
| TOPIK 파생 목록 | `topik1_adjectives.txt` | `topik_vocabulary_combined.csv` 파생 | 즉시 공개 가능(maintainer 확인) | 높음 | 공개 저장소에 함께 둘 수 있다 |
| MeCab 파생 목록 | `mecab_positive_adjectives.txt` | `mecab_va.csv` 파생 | 즉시 공개 가능(maintainer 확인) | 높음 | 공개 저장소에 함께 둘 수 있다 |
| 형용사 중간 산출물 | `adjective_analysis.txt`, `clean_adjectives_top200.txt`, `combined_adjectives.txt`, `final_adjectives_146.txt`, `final_adjectives_clean.txt`, `final_adjectives_refined.txt` | TOPIK/MeCab 혼합 파생 | 즉시 공개 가능(maintainer 확인) | 높음 | 재현 가능한 생성 파이프라인 자료로 공개 가능 |
| 명사/카테고리 중간 산출물 | `wordA_generated.txt`, `wordB_generated.txt`, `wordC_generated.txt`, `wordD_generated.txt`, `wordA_final.txt`, `wordB_final.txt`, `wordC_final.txt`, `wordD_final.txt` | TOPIK/MeCab 혼합 파생 | 즉시 공개 가능(maintainer 확인) | 높음 | 공개 저장소에 함께 둘 수 있다 |
| 최종 단어 데이터 | `word_data.js` | 외부 데이터 기반 최종 산출물 | 즉시 공개 가능(maintainer 확인) | 높음 | 앱 핵심 데이터이며 공개 저장소에 포함 가능 |
| 단어 처리 스크립트 | `analyze_adjectives.py`, `extract_mecab_adjectives.py`, `generate_quality_words.py`, `categorize_nouns.py`, `auto_generate_categories.py`, `refine_word_data.py`, 기타 검사 스크립트 | 저장소 작성물로 보임 | 조건부 공개 | 높음 | 스크립트 자체는 1차 저작물로 보이지만 외부 데이터를 입력으로 사용 |

## 4. 근거 메모

### 4-1. 현재 라이선스 표기

- `package.json`에는 `"license": "ISC"`가 들어 있다.
- 하지만 루트 `LICENSE` 파일은 없다.
- 코드, 데이터, 문서, 미디어의 권리를 분리해서 설명하는 문서도 아직 없다.

즉, 현재 상태는 `오픈소스 전환 의도는 있으나, 자산별 권리경계는 아직 불명확한 상태`다.

### 4-2. TOPIK 데이터 근거

- `topik_vocabulary_combined.csv` 헤더는 아래 필드를 가진다.
  - `topik_level`
  - `korean`
  - `english`
  - `source`
  - `source_doc`
  - `source_url`
- 실제 첫 행에는 `learning-korean.com` 과 PDF/URL 출처가 들어 있다.

따라서 이 파일은 `저장소 내부 독자 제작 데이터`가 아니라 `외부 출처를 재가공한 데이터`로 보는 것이 안전하다.

추가 조사:

- Tammy Korean의 무료 문서 페이지는 `Feel free to download and use it.` 라고 적고 있다.
- `TOPIK I Vocabulary List 1671` 개별 페이지는 `please feel free to use the list for your study` 라고 적고 있다.
- 같은 사이트 푸터에는 `© 2021 Tammy Korean` 표기가 있다.
- 조사 범위 내에서 `CC`, `OFL`, `Apache`, `MIT` 같은 공개 라이선스 표기는 찾지 못했다.

해석:

- `공부용으로 다운로드하고 사용해도 된다`는 표현은 존재한다.
- 그러나 `수정`, `재배포`, `상업적 재사용`, `2차 저작물 배포` 허가로 해석할 근거는 부족하다.

다만 현재는 유지보수자가 공개 가능 여부를 직접 확인했다고 전제하므로, 이 파일과 파생물은 `오픈 저장소 포함 가능 자산`으로 재분류한다.

### 4-3. MeCab 데이터 근거

- `mecab_nng.csv`, `mecab_nnp.csv`, `mecab_va.csv` 는 품사별 사전 추출물 형태다.
- 파일 내부에는 품사 태그(`NNG`, `NNP`, `VA`)가 들어 있다.
- 하지만 저장소 안에는 어떤 사전/버전/라이선스를 썼는지 문서가 없다.

따라서 이 파일들은 `외부 사전 유래 데이터, 출처는 추정되나 라이선스는 미확인`으로 처리해야 한다.

추가 조사:

- Homebrew의 `mecab-ko-dic` 공식 Formula 페이지는 원 출처를 `https://bitbucket.org/eunjeon/mecab-ko-dic` 로 가리키며 라이선스를 `Apache-2.0`으로 표기한다.
- `mecab-ko-dic` 패키지 저장소는 사전 데이터를 `Apache License 2.0` 조건으로 포함했다고 밝힌다.
- 이 패키지는 사전 데이터를 Yongwoon Lee, Yungho Yu가 만든 것으로 설명한다.

해석:

- `mecab-ko-dic` 자체는 Apache-2.0 계열로 재구축 가능한 경로가 있는 것으로 보인다.
- 다만 현재 저장소의 `mecab_*.csv`가 정확히 어떤 버전에서 어떤 과정을 거쳐 만들어졌는지 기록이 없다.
- 따라서 `이 파일들이 Apache-2.0 조건을 만족한다`고 지금 바로 단정하면 안 된다.

다만 현재는 유지보수자가 공개 가능 여부를 직접 확인했다고 전제하므로, `mecab_*.csv` 역시 공개 저장소 포함 가능 자산으로 본다.

### 4-4. 파생 관계 근거

다음 스크립트들이 파생 관계를 명시한다.

- `analyze_adjectives.py` -> `topik_vocabulary_combined.csv` 에서 `topik1_adjectives.txt` 생성
- `extract_mecab_adjectives.py` -> `mecab_va.csv` 에서 `mecab_positive_adjectives.txt` 생성
- `generate_quality_words.py` -> `topik_vocabulary_combined.csv` 와 `mecab_nng.csv` 를 함께 사용
- `categorize_nouns.py` -> `mecab_nng.csv`, `mecab_nnp.csv` 를 사용
- `auto_generate_categories.py` -> `mecab_nng.csv` 를 사용
- `refine_word_data.py` -> 최종 `word_data.js` 를 직접 수정

즉, 현재 단어 체계는 `원본 외부 데이터 -> 중간 정제 파일 -> 최종 앱 데이터` 구조다.

### 4-5. 외부 서비스/자산 로딩 근거

`index.html` 과 `app.js` 는 현재 아래 자산과 서비스를 사용한다.

- Kakao Maps JavaScript SDK / Places
- Pretendard 웹폰트(jsDelivr)
- 로컬 벤더 `vendor/qrcode.min.js`
- 로컬 벤더 `vendor/html2canvas.min.js`
- 저장소 내부 인라인 SVG 아이콘 스프라이트

따라서 코드 저장소 자체를 공개하더라도, 실제 서비스 제공에는 `업스트림 라이선스/약관/브랜드 정책` 검토가 필요하다. 다만 QR 생성과 이미지 저장 런타임은 더 이상 외부 CDN 의존이 아니라 저장소 내부 벤더 파일로 관리된다.

### 4-6. Kakao SDK 조사

- Kakao JavaScript SDK 문서는 앱 관리 페이지의 `JavaScript SDK 도메인`에 도메인을 등록해야 한다고 밝힌다.
- Kakao JavaScript SDK 다운로드 문서는 아래 주의사항을 명시한다.
  - 사용자는 카카오를 사칭해서는 안 된다.
  - SDK 사용 책임은 사용자에게 있다.
  - 사용자는 Kakao SDK를 상업적 용도로 판매할 수 없다.

해석:

- 길마루 저장소의 코드 공개 자체는 가능하더라도, Kakao SDK는 `재라이선스 대상`이 아니다.
- 공익 오픈소스 노선에서도 `Kakao 의존 기능`은 별도 약관 종속 영역으로 표시해야 한다.
- 장기적으로는 공급자 추상화 또는 오픈 지도 스택 전환이 권리관계 단순화에 도움이 된다.

### 4-7. 웹폰트/아이콘/유틸 조사

#### Pretendard

- Pretendard 저장소는 `SIL Open Font License 1.1`로 배포된다고 밝힌다.
- README는 웹폰트 CDN 사용 예시를 직접 제공한다.

판단:

- 현재처럼 웹폰트로 사용하는 것은 가능하다.
- 다만 OFL 조건에 맞는 고지와 Reserved Font Name 주의가 필요하다.

#### Material Icons

- Google Fonts 가이드는 Material Icons를 `Apache License Version 2.0` 하에서 사용할 수 있다고 밝힌다.
- Google Fonts FAQ는 Google Fonts 자산이 오픈소스이며 상업적으로도 사용할 수 있다고 설명한다.

판단:

- 현재 공개 저장소 런타임은 Material Icons에 의존하지 않는다.
- 이 항목은 과거 조사 기록으로만 남기고, 재도입 시 Apache 2.0 고지를 다시 검토하면 된다.

#### QRCode.js

- `davidshimjs/qrcodejs` 저장소는 `MIT license`로 표기한다.

판단:

- 현재는 `vendor/qrcode.min.js`로 저장소 내부에 벤더링되어 있으며, 업스트림 MIT 라이선스를 유지해야 한다.

#### html2canvas

- `niklasvh/html2canvas` 저장소는 `MIT license`로 표기한다.

판단:

- 현재는 `vendor/html2canvas.min.js`로 저장소 내부에 벤더링되어 있으며, 업스트림 MIT 라이선스를 유지해야 한다.

## 5. 즉시 할 일

### 1단계. 공개 저장소 구조 확정

우선 아래를 실제 공개 저장소에 함께 두는 쪽으로 정리하는 것이 맞다.

- 앱 코드
- 테스트 코드
- 빌드/배포 스크립트
- 문서
- 단어 데이터
- 단어 생성 스크립트와 중간 산출물

### 2단계. 계속 경계 표시가 필요한 영역

아래는 공개 가능하더라도 별도 고지나 조건 정리가 필요하다.

- Kakao SDK/Places 연동
- 외부 CDN 자산
- 프로젝트 이름과 브랜딩

### 3단계. 계속 문서화하면 좋은 항목

- TOPIK/MeCab 관련 원출처 메모
- 단어셋 생성 절차
- `word_data.js` 갱신 절차
- SVG/목업/발표 자료의 외부 리소스 사용 여부

### 4단계. 현재 시점의 실무 판단

바로 공개 저장소에 포함 가능한 쪽:

- 코드
- 문서
- 테스트
- 빌드 스크립트
- 단어 데이터와 파생 산출물

주의 표시를 달고 유지 가능한 쪽:

- Kakao 연동 코드
- Pretendard
- QRCode.js
- html2canvas

## 6. 권장 결론

현재 기준으로 길마루를 오픈소스로 전환할 때, 가장 실무적인 판단은 아래다.

- `코드와 문서`: 공개 전환 가능
- `단어 데이터 체계`: 유지보수자 확인 전제하에 공개 전환 가능
- `Kakao 및 외부 폰트 의존`: 사용 조건 정리 필요
- `핵심 남은 이슈`: 외부 서비스 약관, 라이선스 문서화, 공개 저장소 운영 구조

즉, 현재 남은 핵심 작업은 `데이터 제거`가 아니라 `공개 저장소 운영 문서와 라이선스 구조 확정`이다.

## 8. 조사 출처

- Tammy Korean free documents: https://learning-korean.com/pdf/
- Tammy Korean TOPIK I vocabulary page: https://learning-korean.com/elementary/20210101-10466/
- Tammy Korean homepage/footer: https://learning-korean.com/
- Homebrew `mecab-ko-dic`: https://formulae.brew.sh/formula/mecab-ko-dic.html
- `mecab-ko-dic` package repository: https://github.com/LuminosoInsight/mecab-ko-dic
- Kakao JavaScript SDK getting started: https://developers.kakao.com/docs/latest/ko/javascript/getting-started
- Kakao JavaScript SDK download: https://developers.kakao.com/docs/latest/ko/javascript/download
- Google Fonts FAQ: https://developers.google.com/fonts/faq
- Material Icons guide: https://developers.google.com/fonts/docs/material_icons
- Pretendard repository: https://github.com/orioncactus/pretendard
- Pretendard license: https://github.com/orioncactus/pretendard/blob/main/LICENSE
- QRCode.js repository: https://github.com/davidshimjs/qrcodejs
- html2canvas repository: https://github.com/niklasvh/html2canvas

## 7. 추적 범위 밖 메모

현재 워크스페이스에는 아래 유형의 로컬 산출물이 존재할 수 있다.

- `dist/`
- `output/`
- `*.pptx`
- `*.png`
- 추가 `*.csv`, `*.txt`, `*.py`

이들은 `.gitignore`에 걸리거나 현재 추적 범위 밖일 수 있으므로, 외부 공개 전에는 별도 검토가 필요하다.
