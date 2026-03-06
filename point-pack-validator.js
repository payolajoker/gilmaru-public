export const SUPPORTED_SCHEMA_VERSION = '1.0.0';
export const POINT_TYPES = new Set([
  'entrance',
  'accessible_parking',
  'ramp',
  'elevator',
  'accessible_restroom',
  'rest_area',
  'meeting_point',
  'info_desk',
  'transit_stop',
  'quiet_room',
]);
export const POINT_STATUSES = new Set([
  'verified',
  'reported',
  'temporary',
  'inactive',
]);

const packIdPattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const gilmaruCodePattern = /^A\d{3}\.B\d{3}\.C\d{3}\.D\d{3}$/;
const languagePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDate(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isValidUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushError(errors, scope, message) {
  errors.push(`${scope}: ${message}`);
}

export function validatePointPack(pack) {
  const errors = [];

  if (!isPlainObject(pack)) {
    return ['root: pack must be a JSON object'];
  }

  if (pack.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    pushError(
      errors,
      'schemaVersion',
      `must equal ${SUPPORTED_SCHEMA_VERSION}`
    );
  }

  if (!isNonEmptyString(pack.packId) || !packIdPattern.test(pack.packId)) {
    pushError(errors, 'packId', 'must use lowercase letters, numbers, and dashes');
  }

  if (!isNonEmptyString(pack.name)) {
    pushError(errors, 'name', 'is required');
  }

  if (!isNonEmptyString(pack.language) || !languagePattern.test(pack.language)) {
    pushError(errors, 'language', 'must look like ko-KR or en');
  }

  if (!isNonEmptyString(pack.license)) {
    pushError(errors, 'license', 'is required');
  }

  if (pack.homepage !== undefined && !isValidUrl(pack.homepage)) {
    pushError(errors, 'homepage', 'must be a valid http/https URL');
  }

  if (!Array.isArray(pack.maintainers) || pack.maintainers.length === 0) {
    pushError(errors, 'maintainers', 'must contain at least one entry');
  } else {
    pack.maintainers.forEach((maintainer, index) => {
      const scope = `maintainers[${index}]`;
      if (!isPlainObject(maintainer)) {
        pushError(errors, scope, 'must be an object');
        return;
      }

      if (!isNonEmptyString(maintainer.name)) {
        pushError(errors, `${scope}.name`, 'is required');
      }

      if (maintainer.url !== undefined && !isValidUrl(maintainer.url)) {
        pushError(errors, `${scope}.url`, 'must be a valid http/https URL');
      }
    });
  }

  if (pack.sources !== undefined) {
    if (!Array.isArray(pack.sources)) {
      pushError(errors, 'sources', 'must be an array when present');
    } else {
      pack.sources.forEach((source, index) => {
        const scope = `sources[${index}]`;
        if (!isPlainObject(source)) {
          pushError(errors, scope, 'must be an object');
          return;
        }

        if (!isNonEmptyString(source.name)) {
          pushError(errors, `${scope}.name`, 'is required');
        }

        if (source.checkedAt !== undefined && !isValidDate(source.checkedAt)) {
          pushError(errors, `${scope}.checkedAt`, 'must be a valid ISO date');
        }

        if (source.url !== undefined && !isValidUrl(source.url)) {
          pushError(errors, `${scope}.url`, 'must be a valid http/https URL');
        }
      });
    }
  }

  if (!Array.isArray(pack.points) || pack.points.length === 0) {
    pushError(errors, 'points', 'must contain at least one point');
    return errors;
  }

  const ids = new Set();

  pack.points.forEach((point, index) => {
    const scope = `points[${index}]`;

    if (!isPlainObject(point)) {
      pushError(errors, scope, 'must be an object');
      return;
    }

    if (!isNonEmptyString(point.id) || !packIdPattern.test(point.id)) {
      pushError(errors, `${scope}.id`, 'must use lowercase letters, numbers, and dashes');
    } else if (ids.has(point.id)) {
      pushError(errors, `${scope}.id`, `duplicate id "${point.id}"`);
    } else {
      ids.add(point.id);
    }

    if (!POINT_TYPES.has(point.type)) {
      pushError(errors, `${scope}.type`, 'must be a supported point type');
    }

    if (!isNonEmptyString(point.name)) {
      pushError(errors, `${scope}.name`, 'is required');
    }

    if (point.gilmaruCode !== undefined && !gilmaruCodePattern.test(point.gilmaruCode)) {
      pushError(errors, `${scope}.gilmaruCode`, 'must match A000.B000.C000.D000');
    }

    if (!isPlainObject(point.coordinates)) {
      pushError(errors, `${scope}.coordinates`, 'must be an object');
    } else {
      const { lat, lng } = point.coordinates;
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        pushError(errors, `${scope}.coordinates.lat`, 'must be between -90 and 90');
      }

      if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        pushError(errors, `${scope}.coordinates.lng`, 'must be between -180 and 180');
      }
    }

    if (!POINT_STATUSES.has(point.status)) {
      pushError(errors, `${scope}.status`, 'must be a supported status');
    }

    if (!isValidDate(point.lastUpdated)) {
      pushError(errors, `${scope}.lastUpdated`, 'must be a valid ISO date-time');
    }

    if (point.status === 'verified' && !isValidDate(point.verifiedAt)) {
      pushError(errors, `${scope}.verifiedAt`, 'is required for verified points');
    }

    if (point.verifiedAt !== undefined && !isValidDate(point.verifiedAt)) {
      pushError(errors, `${scope}.verifiedAt`, 'must be a valid ISO date');
    }

    if (point.tags !== undefined) {
      if (!Array.isArray(point.tags)) {
        pushError(errors, `${scope}.tags`, 'must be an array');
      } else if (new Set(point.tags).size !== point.tags.length) {
        pushError(errors, `${scope}.tags`, 'must not contain duplicates');
      }
    }

    if (point.links !== undefined) {
      if (!Array.isArray(point.links)) {
        pushError(errors, `${scope}.links`, 'must be an array');
      } else {
        point.links.forEach((link, linkIndex) => {
          const linkScope = `${scope}.links[${linkIndex}]`;
          if (!isPlainObject(link)) {
            pushError(errors, linkScope, 'must be an object');
            return;
          }

          if (!isNonEmptyString(link.label)) {
            pushError(errors, `${linkScope}.label`, 'is required');
          }

          if (!isValidUrl(link.url)) {
            pushError(errors, `${linkScope}.url`, 'must be a valid http/https URL');
          }
        });
      }
    }

    if (point.accessibility !== undefined) {
      if (!isPlainObject(point.accessibility)) {
        pushError(errors, `${scope}.accessibility`, 'must be an object');
      } else {
        const { doorWidthCm } = point.accessibility;
        if (
          doorWidthCm !== undefined &&
          (typeof doorWidthCm !== 'number' || doorWidthCm < 0 || doorWidthCm > 1000)
        ) {
          pushError(errors, `${scope}.accessibility.doorWidthCm`, 'must be between 0 and 1000');
        }
      }
    }
  });

  return errors;
}
