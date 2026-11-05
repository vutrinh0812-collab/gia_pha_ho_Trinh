import { expect, test, type Page } from '@playwright/test';

// Fictitious sample data: p0001 is the root ancestor "Trịnh Công Nguyên".
const ROOT_ID = 'p0001';
const ROOT_NAME = 'Trịnh Công Nguyên';

/** Records Web Share calls instead of opening the system sheet. */
async function stubShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: unknown) => {
        w.__shared.push(data);
      },
    });
  });
}

async function noHorizontalScroll(page: Page) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll).toBeLessThanOrEqual(inner);
}

test('shared link → family → search → details → share', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubShare(page);

  // 1. Open a shared person link (as from Zalo/Messenger): old /person/ links land on the profile page.
  await page.goto(`/person/${ROOT_ID}`);
  await expect(page).toHaveURL(new RegExp(`/nguoi/${ROOT_ID}$`));
  const profile = page.getByRole('article', { name: `Trang của ${ROOT_NAME}` });
  await expect(profile.getByRole('heading', { level: 1, name: ROOT_NAME })).toBeVisible();
  await profile.getByRole('button', { name: 'Gia đình' }).click();

  // 2. Family view, readable without zooming.
  const centre = page.getByRole('heading', { level: 1, name: ROOT_NAME });
  await expect(centre).toBeVisible();
  const nameSize = await centre.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(nameSize).toBeGreaterThanOrEqual(17);
  await noHorizontalScroll(page);

  // 3. Search without diacritics.
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Tìm kiếm' }).click();
  await page.getByRole('searchbox').fill('trinh van viet');
  const search = page.getByRole('dialog', { name: 'Tìm kiếm' });
  const hit = search.getByRole('button', { name: /Trịnh Văn Việt/ }).first();
  await expect(hit).toContainText('Đời 3');
  await hit.click();

  // 4. Details open.
  const details = page.getByRole('dialog', { name: /Thông tin Trịnh Văn Việt/ });
  await expect(details).toBeVisible();
  await expect(details.getByRole('region', { name: 'Ngày giỗ' })).toBeVisible();

  // 5. Share uses the phone's share sheet with the person link.
  await details.getByRole('button', { name: 'Chia sẻ' }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: Array<{ url: string }> }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]!.url).toMatch(/\/nguoi\/p\d{4}$/);

  // Touch targets: bottom navigation buttons are at least 44×44.
  for (const box of await page.getByRole('navigation', { name: 'Điều hướng chính' }).locator('a, button').evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]),
  )) {
    expect(box[0]).toBeGreaterThanOrEqual(44);
    expect(box[1]).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});

test('tree view survives rotating to landscape', async ({ page, viewport }) => {
  await page.goto('/so-do');
  const tree = page.getByRole('group', { name: 'Sơ đồ gia phả' });
  await expect(tree).toBeVisible();
  await expect(tree.getByRole('button', { name: new RegExp(`^${ROOT_NAME}, đời 1`) })).toBeVisible();

  await page.setViewportSize({ width: viewport!.height, height: viewport!.width });
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Phóng to' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Về thủy tổ' })).toBeInViewport();
  await page.getByRole('button', { name: 'Phóng to' }).click();
  await expect(tree.getByRole('button', { name: new RegExp(`^${ROOT_NAME}`) })).toBeVisible();
  await noHorizontalScroll(page);
  // Compact bottom bar in landscape leaves room for the tree.
  const navHeight = await page.getByRole('navigation', { name: 'Điều hướng chính' }).evaluate((el) => el.getBoundingClientRect().height);
  expect(navHeight).toBeLessThanOrEqual(64);
});

test('works when the in-app browser blocks storage, sharing and the clipboard', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: blocked });
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('blocked')) },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/person/${ROOT_ID}`);
  const profile = page.getByRole('article', { name: `Trang của ${ROOT_NAME}` });
  await profile.getByRole('button', { name: 'Chia sẻ' }).click();
  await expect(profile.getByRole('status')).toContainText(`/nguoi/${ROOT_ID}`);
  // Preferences still work for this visit.
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByRole('switch', { name: /Chữ lớn/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
  expect(errors).toEqual([]);
});

test('link previews: Open Graph tags, manifest and icons', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('<meta property="og:title" content="Gia Phả Họ Trịnh" />');
  expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/og-image\.png" \/>/);
  expect(html).toContain('lang="vi"');
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as { icons: Array<{ src: string }> };
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  const og = await request.get('/og-image.png');
  expect(og.headers()['content-type']).toContain('image/png');
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('opens from the cache without a network', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'pixel-5', 'one device is enough');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: ROOT_NAME })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // now controlled by the service worker
    await expect(page.getByRole('heading', { level: 1, name: ROOT_NAME })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: ROOT_NAME })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'mất mạng' })).toBeVisible();
    // The lazily-loaded tree (never opened online) also comes from the cache.
    await page.getByRole('link', { name: 'Sơ đồ' }).click();
    await expect(page.getByRole('group', { name: 'Sơ đồ gia phả' })).toBeVisible();
    await context.setOffline(false);
  });
});

test('in-app browser shows how to open the real browser', async ({ page }, info) => {
  test.skip(!['zalo-android', 'facebook-ios'].includes(info.project.name), 'in-app browsers only');
  await page.goto('/?them=1');
  const name = info.project.name === 'zalo-android' ? 'Zalo' : 'Facebook';
  await expect(page.getByText(`Bạn đang mở trong ${name}`)).toBeVisible();
});
