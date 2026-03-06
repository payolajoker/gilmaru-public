# 운영 런북
관련 문서: [README](../README.md) | [요구사항/백로그](./requirements-backlog.md) | [아키텍처](./architecture-overview.md) | [품질 기준](./quality-definition.md)

## 운영 개요
- 배포 대상: GitHub Pages 단일 경로
- 공개 URL: `https://payolajoker.github.io/gilmaru-public/`
- Vite base: `/gilmaru-public/`
- Owner: `Payola Joker`
- 연락 채널: `TBD`

## 환경별 실행 절차
### Local
```bash
npm install
npm run dev
```

`open` 지도 검색까지 로컬에서 확인하려면:

```bash
npm run proxy:geocoder
npm run dev
```

### Test
```bash
npm run test -- --run
npm run test:e2e
```

### Build
```bash
npm run build
```

메모:
- `npm run build`는 `scripts/build-safe.cjs`를 사용합니다.
- Windows + 비ASCII 경로에서는 임시 ASCII 워크스페이스에서 빌드 후 `dist`를 복사합니다.
- 순수 Vite 빌드 확인용: `npm run build:raw`
- 빌드 시 `vite.config.js`가 `sw.js`를 `dist/sw.js`로 복사합니다.
- `scripts/open-geocoder-proxy.mjs`는 로컬/자가호스팅용 Open 지오코더 프록시입니다.

### Preview
```bash
npm run preview
```

### Deploy
`main` 브랜치 push 시 `.github/workflows/pages.yml` 이 GitHub Pages를 자동 배포합니다.

## 릴리스 절차
### 1) 사전 체크
1. 작업 브랜치 변경사항 확인
2. `npm run test -- --run` 통과
3. `npm run test:e2e` 통과
4. `npm run build` 성공
5. README/docs 변경 필요 시 반영

### 2) 배포
1. `npm run deploy`
2. GitHub Pages 반영 대기

### 3) 배포 후 검증
1. 배포 URL 접속 확인
2. 핵심 플로우 확인
- 지도 로드 및 주소 갱신
- 장소 검색/길마루 검색
- 복사/공유/QR
- 딥링크(`?code=`)
3. 브라우저 콘솔 주요 오류/경고 확인

## 장애 대응
### 1차 점검
- 정적 자산 경로(`/gilmaru-public/`) 확인
- 최근 배포 커밋과 증상 연관 확인
- 브라우저 강력 새로고침/서비스워커 갱신 안내

### 롤백
1. 직전 정상 커밋 식별
2. 해당 커밋으로 재배포(`npm run deploy`)
3. 배포 URL 재검증

### 에스컬레이션
- 1차: Payola Joker
- 2차: TBD
- 응답시간(SLA/SLO): `Not found in repo.`

## 보안/키 관리
- Kakao Maps JavaScript 키는 `VITE_KAKAO_JS_KEY`로 환경별 주입 가능합니다.
- 로컬 기본값 예시는 `.env.example`에 있습니다.
- 키 미주입 시 앱은 공개 JS 키 fallback을 사용합니다(`app.js`).
- Open 지오코더 프록시는 `OPEN_GEOCODER_*` 환경변수로 조정할 수 있습니다.
- 비밀키 저장 정책: `Not found in repo.`
- 키 회전/폐기 절차: `Not found in repo.`

## 모니터링/알림
- 모니터링 도구: `Not found in repo.`
- 알림 채널: `Not found in repo.`
