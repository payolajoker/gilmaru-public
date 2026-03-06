import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fakeLeafletPath = fileURLToPath(new URL('./fake-leaflet-init.js', import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: fakeLeafletPath });

  await page.route('https://nominatim.openstreetmap.org/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/reverse')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: 'Open Road 1, Seocho, Seoul',
          address: {
            road: 'Open Road',
            house_number: '1',
            suburb: 'Seocho',
            city: 'Seoul',
          },
        }),
      });
      return;
    }

    if (url.includes('/search')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'Open Test Park',
            display_name: 'Open Test Park, Open Road 1, Seocho, Seoul',
            lat: '37.5010',
            lon: '127.0390',
            address: {
              road: 'Open Road',
              house_number: '1',
              suburb: 'Seocho',
              city: 'Seoul',
              tourism: 'Open Test Park',
            },
          },
        ]),
      });
      return;
    }

    await route.fallback();
  });
});

test('loads the OpenStreetMap fallback when requested', async ({ page }) => {
  await page.goto('?provider=open&geocoder=direct');

  await expect(page.locator('#address-text')).not.toContainText('로딩중');
  await expect(page.locator('#road-address')).toContainText('Open Road 1');
  await expect(page.locator('#sentence-text')).not.toHaveText('');
});

test('searches a place in OpenStreetMap mode on submit', async ({ page }) => {
  await page.goto('?provider=open&geocoder=direct');

  await page.fill('#search-input', 'open test park');
  await page.press('#search-input', 'Enter');

  await expect(page.locator('#road-address')).toContainText('Open Road 1');
  await expect(page.locator('#address-text')).not.toContainText('로딩중');
});

test('uses a stored open provider preference without a query parameter', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('gilmaru.mapProviderPreference', 'open');
  });

  await page.goto('/?geocoder=direct');

  await expect(page.locator('body')).toHaveAttribute('data-map-provider', 'openstreetmap');
  await expect(page.locator('#provider-status-text')).toContainText('OpenStreetMap');
  await expect(page.locator('#btn-provider-open')).toHaveAttribute('aria-pressed', 'true');
});

test('falls back to coordinate labels on local preview when direct geocoding is disabled', async ({ page }) => {
  await page.goto('?provider=open&geocoder=fallback');

  await expect(page.locator('#provider-status-text')).toContainText('로컬 좌표 안내');
  await expect(page.locator('#road-address')).toContainText('좌표 37.4979,127.0276');

  await page.fill('#search-input', 'open test park');
  await page.press('#search-input', 'Enter');
  await expect(page.locator('#toast')).toContainText('로컬 공개 모드에서는 장소 검색이 제한됩니다');
});
