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
  await page.goto('?provider=open');

  await expect(page.locator('#address-text')).not.toContainText('로딩중');
  await expect(page.locator('#road-address')).toContainText('Open Road 1');
  await expect(page.locator('#sentence-text')).not.toHaveText('');
});

test('searches a place in OpenStreetMap mode on submit', async ({ page }) => {
  await page.goto('?provider=open');

  await page.fill('#search-input', 'open test park');
  await page.press('#search-input', 'Enter');

  await expect(page.locator('#road-address')).toContainText('Open Road 1');
  await expect(page.locator('#address-text')).not.toContainText('로딩중');
});

test('uses a stored open provider preference without a query parameter', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('gilmaru.mapProviderPreference', 'open');
  });

  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-map-provider', 'openstreetmap');
  await expect(page.locator('#provider-status-text')).toContainText('OpenStreetMap');
  await expect(page.locator('#btn-provider-open')).toHaveAttribute('aria-pressed', 'true');
});
