import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { wordA, wordB, wordC, wordD } from '../../word_data.js';

const fakeKakaoPath = fileURLToPath(new URL('./fake-kakao-init.js', import.meta.url));
const samplePointPackPath = fileURLToPath(new URL('../../data/point-packs/examples/gangnam-station-access-pack.json', import.meta.url));
const LOADING_TEXT = '\uB85C\uB529\uC911...';
const MAP_LOAD_FAILURE_TEXT = '\uC9C0\uB3C4 \uB85C\uB4DC \uC2E4\uD328';
const TEST_ROAD_PREFIX = '\uC11C\uC6B8 \uD14C\uC2A4\uD2B8\uB85C';
const MOVE_TO_ADDRESS_TOAST = '\uC8FC\uC18C \uC704\uCE58\uB85C \uC774\uB3D9\uD588\uC2B5\uB2C8\uB2E4.';
const INVALID_GILMARU_TOAST = '\uC798\uBABB\uB41C \uAE38\uB9C8\uB8E8 \uC8FC\uC18C \uD615\uC2DD\uC785\uB2C8\uB2E4.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: fakeKakaoPath });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedText = value;
        },
      },
    });

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__sharedPayload = payload;
      },
    });
  });
});

async function getDisplayedAddress(page) {
  return page.evaluate(() => {
    const addressNode = document.getElementById('address-text')?.firstChild;
    return addressNode?.textContent?.trim() ?? '';
  });
}

test('loads the app shell and resolves the initial address', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#address-text')).not.toContainText(LOADING_TEXT);
  await expect(page.locator('#address-text')).not.toContainText(MAP_LOAD_FAILURE_TEXT);
  await expect(page.locator('#road-address')).toContainText(TEST_ROAD_PREFIX);
  await expect(page.locator('#sentence-text')).not.toHaveText('');
});

test('resolves an explicit deep link code on first load', async ({ page }) => {
  const deepLinkCode = [wordD[0], wordB[0], wordA[0], wordC[0]].join('.');

  await page.goto(`/?code=${encodeURIComponent(deepLinkCode)}`);

  await expect(page.locator('#address-text')).toContainText(`${wordA[0]} ${wordB[0]} ${wordC[0]} ${wordD[0]}`);
});

test('resolves a shuffled Gilmaru word address', async ({ page }) => {
  const shuffledAddress = [wordD[0], wordB[0], wordA[0], wordC[0]].join(' ');

  await page.goto('/');
  await page.fill('#search-input', shuffledAddress);
  await page.press('#search-input', 'Enter');

  await expect(page.locator('#address-text')).toContainText(`${wordA[0]} ${wordB[0]} ${wordC[0]} ${wordD[0]}`);
  await expect(page.locator('#toast')).toContainText(MOVE_TO_ADDRESS_TOAST);
});

test('keeps four-word place queries in place search flow', async ({ page }) => {
  const placeQuery = 'alpha beta gamma park';

  await page.goto('/');
  await page.fill('#search-input', placeQuery);

  await expect(page.locator('#search-results')).toContainText(placeQuery);

  await page.press('#search-input', 'Enter');

  await expect(page.locator('#toast')).toContainText(placeQuery);
  await expect(page.locator('#road-address')).toContainText(placeQuery);
});

test('treats dotted invalid input as a Gilmaru address error', async ({ page }) => {
  await page.goto('/');
  await page.fill('#search-input', 'A001.B001.C001.D999');
  await page.press('#search-input', 'Enter');

  await expect(page.locator('#toast')).toContainText(INVALID_GILMARU_TOAST);
  await expect.poll(() => page.evaluate(() => window.__gilmaruTestState?.lastKeywordSearch ?? null)).toBe(null);
});

test('copies the current address and shares the current deep link', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#address-text')).not.toContainText(LOADING_TEXT);
  const displayedAddress = await getDisplayedAddress(page);

  await page.click('#btn-copy');
  await expect.poll(() => page.evaluate(() => window.__copiedText ?? null)).toBe(displayedAddress);

  await page.click('#btn-share');
  await expect.poll(() => page.evaluate(() => window.__sharedPayload?.title ?? '')).toContain('\uAE38\uB9C8\uB8E8');
  await expect.poll(() => page.evaluate(() => window.__sharedPayload?.url ?? '')).toContain('?code=');
});

test('opens the QR modal with the current address and closes it again', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#address-text')).not.toContainText(LOADING_TEXT);
  const displayedAddress = await getDisplayedAddress(page);

  await page.click('#btn-qr');
  await expect(page.locator('#qr-modal')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('#qr-gilmaru-text').evaluate((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    )
    .toBe(displayedAddress);
  await expect
    .poll(() =>
      page
        .locator('#qr-code-display')
        .evaluate((node) => node.dataset.qrText || (node.querySelector('canvas, img') ? 'generated' : ''))
    )
    .not.toBe('');

  await page.press('#qr-modal', 'Escape');
  await expect(page.locator('#qr-modal')).not.toBeVisible();
});

test('opens the intro modal and restores focus to the trigger when closed', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-intro');
  await expect(page.locator('#intro-modal')).toBeVisible();
  await expect(page.locator('#btn-close-intro')).toBeFocused();

  await page.press('#intro-modal', 'Escape');
  await expect(page.locator('#intro-modal')).not.toBeVisible();
  await expect(page.locator('#btn-intro')).toBeFocused();
});

test('focuses the search input with the slash shortcut', async ({ page }) => {
  await page.goto('/');

  await page.locator('body').press('/');
  await expect(page.locator('#search-input')).toBeFocused();
});

test('resets searched place metadata when moving to current location', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 37.5665, longitude: 126.978 });

  await page.goto('/');
  await page.fill('#search-input', 'alpha beta gamma park');
  await page.press('#search-input', 'Enter');
  await expect(page.locator('#road-address')).toContainText('alpha beta gamma park');

  await page.click('#btn-my-location');

  await expect(page.locator('#toast')).toContainText('\uD604\uC7AC \uC704\uCE58\uB85C \uC774\uB3D9');
  await expect(page.locator('#road-address')).toContainText('37.5665,126.9780');
  await expect(page.locator('#road-address')).not.toContainText('alpha beta gamma park');
});

test('imports a point pack file and focuses a selected point', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('#point-pack-input', samplePointPackPath);

  await expect(page.locator('#point-pack-panel')).toBeVisible();
  await expect(page.locator('#point-pack-title')).toContainText('Gangnam Station Access Pack');
  await expect(page.locator('#point-pack-selected-name')).toContainText('Gangnam plaza meeting point');
  await expect(page.locator('#place-name')).toContainText('Gangnam plaza meeting point');

  await page.click('[data-point-id="gangnam-elevator-link"]');

  await expect(page.locator('#point-pack-selected-name')).toContainText('Station elevator access');
  await expect(page.locator('#place-name')).toContainText('Station elevator access');
});

test('toggles easy guidance mode and loads the sample point pack', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#point-pack-panel')).toBeVisible();
  await page.click('#btn-toggle-guidance');
  await expect(page.locator('body')).toHaveAttribute('data-guidance-mode', 'easy');
  await expect(page.locator('#guidance-panel')).toBeVisible();
  await expect(page.locator('#guidance-panel')).toContainText('복사 또는 공유');
  await expect(page.locator('#point-pack-selected-guidance')).toContainText('지도가 이 위치로 이동합니다');

  await page.click('#btn-clear-point-pack');
  await expect(page.locator('#point-pack-panel')).not.toBeVisible();
  await page.locator('#btn-load-sample-pack').scrollIntoViewIfNeeded();
  await page.click('#btn-load-sample-pack');

  await expect(page.locator('#point-pack-panel')).toBeVisible();
  await expect(page.locator('#point-pack-source')).toContainText('샘플 팩');
});
