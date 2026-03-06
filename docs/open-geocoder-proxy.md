# Open Geocoder Proxy

길마루 공개 저장소는 정적 앱이므로, GitHub Pages 자체에는 검색 프록시를 같이 둘 수
없습니다. 대신 로컬 개발이나 자가 호스팅 환경에서 바로 붙일 수 있는 최소 프록시
서버를 `scripts/open-geocoder-proxy.mjs` 로 제공합니다.

## 왜 필요한가

- 브라우저가 공용 Nominatim을 직접 호출하면 CORS 에러가 날 수 있습니다.
- 공용 엔드포인트 직접 호출은 사용정책과 트래픽 관리 측면에서도 거칠 수 있습니다.
- 프록시를 두면 검색과 역지오코딩을 서버 쪽에서 제어하고 짧은 캐시를 붙일 수 있습니다.

## 빠른 시작

터미널 1:

```bash
npm run proxy:geocoder
```

터미널 2:

```bash
npm run dev
```

그리고 앱 설정에 아래 둘 중 하나를 넣습니다.

`.env`

```bash
VITE_OPEN_GEOCODER_MODE=proxy
VITE_OPEN_GEOCODER_BASE_URL=http://127.0.0.1:8787/nominatim
```

또는 `gilmaru.config.local.json`

```json
{
  "openGeocoderMode": "proxy",
  "openGeocoderBaseUrl": "http://127.0.0.1:8787/nominatim"
}
```

## 프록시 환경 변수

- `OPEN_GEOCODER_HOST`
  - 기본값: `127.0.0.1`
- `OPEN_GEOCODER_PORT`
  - 기본값: `8787`
- `OPEN_GEOCODER_PREFIX`
  - 기본값: `/nominatim`
- `OPEN_GEOCODER_UPSTREAM_BASE_URL`
  - 기본값: `https://nominatim.openstreetmap.org`
- `OPEN_GEOCODER_CACHE_TTL_MS`
  - 기본값: `60000`
- `OPEN_GEOCODER_TIMEOUT_MS`
  - 기본값: `8000`
- `OPEN_GEOCODER_USER_AGENT`
  - 기본값: 길마루 공개 저장소용 식별 문자열
- `OPEN_GEOCODER_CONTACT_EMAIL`
  - 필요 시 upstream 요청에 `email` 파라미터를 추가

## 지원 경로

- `GET /nominatim/reverse`
- `GET /nominatim/search`
- `GET /healthz`

이 외 경로는 프록시하지 않습니다.

## 구현 메모

- GET만 허용
- CORS 허용
- 짧은 메모리 캐시 사용
- 허용된 query parameter만 upstream으로 전달
- `format=jsonv2` 강제

## 권장 운영 방식

- 로컬 개발: 이 스크립트 그대로 사용
- 자가 호스팅: 앞단 리버스 프록시 뒤에 두고 rate limit 추가
- 공개 서비스: 필요하면 이 스크립트를 기반으로 별도 서비스로 분리
