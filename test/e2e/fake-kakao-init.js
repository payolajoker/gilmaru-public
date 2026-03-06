(function installGilmaruTestDoubles() {
  const STATUS = {
    OK: 'OK',
    ZERO_RESULT: 'ZERO_RESULT',
    ERROR: 'ERROR',
  };

  function addListener(target, eventName, handler) {
    if (!target.__listeners) target.__listeners = {};
    if (!target.__listeners[eventName]) target.__listeners[eventName] = [];
    target.__listeners[eventName].push(handler);
  }

  function trigger(target, eventName) {
    const handlers = target.__listeners?.[eventName] || [];
    handlers.forEach((handler) => handler());
  }

  class LatLng {
    constructor(lat, lng) {
      this.lat = Number(lat);
      this.lng = Number(lng);
    }

    getLat() {
      return this.lat;
    }

    getLng() {
      return this.lng;
    }
  }

  class LatLngBounds {
    constructor(southWest, northEast) {
      this.southWest = southWest;
      this.northEast = northEast;
    }

    getSouthWest() {
      return this.southWest;
    }

    getNorthEast() {
      return this.northEast;
    }
  }

  class FakeMap {
    constructor(container, options) {
      this.container = container;
      this.center = options.center;
      this.level = options.level ?? 3;
    }

    getCenter() {
      return this.center;
    }

    setCenter(latLng) {
      this.center = latLng;
      setTimeout(() => trigger(this, 'idle'), 0);
    }

    getLevel() {
      return this.level;
    }

    setLevel(level) {
      this.level = level;
      setTimeout(() => trigger(this, 'idle'), 0);
    }

    getBounds() {
      const delta = Math.max(0.01, this.level * 0.005);
      return new LatLngBounds(
        new LatLng(this.center.getLat() - delta, this.center.getLng() - delta),
        new LatLng(this.center.getLat() + delta, this.center.getLng() + delta)
      );
    }

    getProjection() {
      return {
        containerPointFromCoords: (coords) => ({
          x: Math.round((coords.getLng() - this.center.getLng()) * 100_000) + 200,
          y: Math.round((this.center.getLat() - coords.getLat()) * 100_000) + 200,
        }),
      };
    }
  }

  class Rectangle {
    constructor(options) {
      this.options = options;
    }

    setMap(map) {
      this.map = map;
    }
  }

  class Geocoder {
    coord2Address(lng, lat, callback) {
      const roundedLat = Number(lat).toFixed(4);
      const roundedLng = Number(lng).toFixed(4);

      setTimeout(() => {
        callback(
          [
            {
              road_address: {
                address_name: `서울 테스트로 ${roundedLat},${roundedLng}`,
                building_name: '테스트 빌딩',
              },
              address: {
                address_name: '서울 테스트동',
              },
            },
          ],
          STATUS.OK
        );
      }, 0);
    }
  }

  class Places {
    keywordSearch(keyword, callback) {
      const trimmed = String(keyword).trim();
      window.__gilmaruTestState = {
        ...(window.__gilmaruTestState || {}),
        lastKeywordSearch: trimmed,
      };

      setTimeout(() => {
        if (!trimmed || trimmed === '검색 없음') {
          callback([], STATUS.ZERO_RESULT);
          return;
        }

        callback(
          [
            {
              place_name: trimmed,
              road_address_name: `서울 테스트로 ${trimmed}`,
              address_name: `서울 테스트동 ${trimmed}`,
              y: '37.5010',
              x: '127.0390',
            },
          ],
          STATUS.OK
        );
      }, 0);
    }
  }

  window.kakao = {
    maps: {
      load(callback) {
        callback();
      },
      Map: FakeMap,
      LatLng,
      LatLngBounds,
      Rectangle,
      event: {
        addListener,
      },
      services: {
        Geocoder,
        Places,
        Status: STATUS,
      },
    },
  };

  window.QRCode = function QRCode(container, options) {
    container.dataset.qrText = options.text;
  };
  window.QRCode.CorrectLevel = { H: 'H' };

  window.html2canvas = async function html2canvas() {
    const canvas = document.createElement('canvas');
    canvas.toDataURL = () => 'data:image/png;base64,';
    return canvas;
  };
})();
