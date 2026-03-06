# 품질 기준 (Definition of Done)
관련 문서: [README](../README.md) | [요구사항/백로그](./requirements-backlog.md) | [아키텍처](./architecture-overview.md) | [운영 런북](./operations-runbook.md)

## 품질 목표
1. 좌표-코드-단어 변환 정확성 유지
2. 사용자 핵심 플로우(검색/공유/QR/딥링크) 안정성 유지
3. 릴리스 전 테스트/빌드/배포 검증 일관성 유지

## DoD 체크리스트
### 코드/기능
- [ ] 요구사항 범위와 구현이 일치한다.
- [ ] 주요 플로우 회귀가 없다.
- [ ] 근거 없는 항목은 `Not found in repo.`로 표기한다.

### 테스트
- [ ] `npm run test -- --run` 통과
- [ ] 영향 기능 수동 점검 완료
- [ ] 필요 시 E2E 실행/결과 기록

### 문서
- [ ] README와 관련 docs 링크/설명이 최신 상태
- [ ] 스크립트/운영 절차 변경사항 반영

### 빌드/배포
- [ ] `npm run build` 성공
- [ ] 배포 URL 핵심 플로우 검증

## 테스트 전략
### Unit Test
- 도구: `vitest`
- 파일: `test/core.test.js`
- 범위:
- 좌표→코드 변환
- 코드→단어 변환
- 경계 좌표
- sentence/fullAddress 처리

### E2E
- 명령: `npm run test:e2e` (`playwright test`)
- 시나리오 스펙 파일: `test/e2e/smoke.spec.js`
- 테스트 더블: `test/e2e/fake-kakao-init.js`
- 실행 모드: `built-dist`(Vite preview) + `raw-root`(저장소 루트 정적 서빙)

## 수동 검증 시나리오
- 지도 로드 후 주소 카드 갱신
- 장소 검색 + 자동완성 선택 이동
- 길마루 검색(단어 형식/코드 형식)
- 주소 복사/공유/QR 생성
- 딥링크 `?code=` 직접 진입
- 모달 열기/닫기 + 키보드 포커스 트랩
- Skip Link(`검색으로 바로가기`) 동작
- `/` 키로 검색창 포커스
- 서비스워커 캐시 기본 동작

## 품질 게이트
### PR 전
```bash
npm run test -- --run
npm run build
```

### 릴리스 전
```bash
npm run build
npm run deploy
```
