(function installLeafletTestDouble() {
  function addListener(target, eventName, handler) {
    if (!target.__listeners) target.__listeners = {};
    if (!target.__listeners[eventName]) target.__listeners[eventName] = [];
    target.__listeners[eventName].push(handler);
  }

  function trigger(target, eventName) {
    const handlers = target.__listeners?.[eventName] || [];
    handlers.forEach((handler) => handler());
  }

  function normalizeCoords(value) {
    if (Array.isArray(value)) {
      return { lat: Number(value[0]), lng: Number(value[1]) };
    }

    return {
      lat: Number(value?.lat ?? 37.4979),
      lng: Number(value?.lng ?? 127.0276),
    };
  }

  class FakeLeafletMap {
    constructor(container) {
      this.container = container;
      this.center = { lat: 37.4979, lng: 127.0276 };
      this.zoom = 16;
    }

    setView(coords, zoom) {
      this.center = normalizeCoords(coords);
      if (typeof zoom === 'number') this.zoom = zoom;
      setTimeout(() => {
        trigger(this, 'moveend');
        trigger(this, 'zoomend');
      }, 0);
      return this;
    }

    getCenter() {
      return { ...this.center };
    }

    getZoom() {
      return this.zoom;
    }

    setZoom(zoom) {
      this.zoom = Number(zoom);
      setTimeout(() => {
        trigger(this, 'zoomend');
      }, 0);
      return this;
    }

    getBounds() {
      const delta = Math.max(0.01, (19 - this.zoom) * 0.005);
      return {
        getSouthWest: () => ({ lat: this.center.lat - delta, lng: this.center.lng - delta }),
        getNorthEast: () => ({ lat: this.center.lat + delta, lng: this.center.lng + delta }),
      };
    }

    latLngToContainerPoint(coords) {
      const value = normalizeCoords(coords);
      return {
        x: Math.round((value.lng - this.center.lng) * 100000) + 200,
        y: Math.round((this.center.lat - value.lat) * 100000) + 200,
      };
    }

    on(eventName, handler) {
      addListener(this, eventName, handler);
      return this;
    }

    removeLayer(layer) {
      if (layer && typeof layer.remove === 'function') {
        layer.remove();
      }
    }
  }

  function createMarker(coords, options = {}) {
    return {
      coords: normalizeCoords(coords),
      options,
      addTo() {
        return this;
      },
      on(eventName, handler) {
        addListener(this, eventName, handler);
        return this;
      },
      remove() {},
    };
  }

  window.L = {
    map(container) {
      return new FakeLeafletMap(container);
    },
    tileLayer() {
      return {
        addTo() {
          return this;
        },
      };
    },
    control: {
      zoom() {
        return {
          addTo() {
            return this;
          },
        };
      },
    },
    rectangle() {
      return {
        addTo() {
          return this;
        },
        remove() {},
      };
    },
    circleMarker(coords, options) {
      return createMarker(coords, options);
    },
    marker(coords, options) {
      return createMarker(coords, options);
    },
  };
})();
