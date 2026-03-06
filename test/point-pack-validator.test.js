import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { validatePointPack } from '../scripts/validate-point-pack.mjs';

const samplePath = new URL(
  '../data/point-packs/examples/seoul-cityhall-access-pack.json',
  import.meta.url
);

async function loadSamplePack() {
  const raw = await readFile(samplePath, 'utf8');
  return JSON.parse(raw);
}

describe('point-pack validator', () => {
  it('accepts the example pack', async () => {
    const pack = await loadSamplePack();
    expect(validatePointPack(pack)).toEqual([]);
  });

  it('rejects duplicate point ids and missing verifiedAt', async () => {
    const pack = await loadSamplePack();
    const brokenPack = structuredClone(pack);

    brokenPack.points[1].id = brokenPack.points[0].id;
    brokenPack.points[0].status = 'verified';
    delete brokenPack.points[0].verifiedAt;

    const errors = validatePointPack(brokenPack);

    expect(errors.some((error) => error.includes('duplicate id'))).toBe(true);
    expect(errors.some((error) => error.includes('verifiedAt'))).toBe(true);
  });
});
