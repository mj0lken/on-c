import { expect, Locator, Page, test } from '@playwright/test';

/** Fails if an overlay renders collapsed (the WebKit flex bugs we hit in the desktop app). */
async function expectFullSize(overlay: Locator) {
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box, 'overlay has a layout box').not.toBeNull();
  expect(box!.height, 'overlay is not collapsed').toBeGreaterThan(300);
  expect(box!.width).toBeGreaterThan(300);
}

async function expectInsideViewport(page: Page, overlay: Locator) {
  const box = (await overlay.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('button', { name: /^\/help/ })).toBeVisible();
});

test('/help opens full size, centered, without dimmed backdrop', async ({ page }) => {
  await page.getByRole('button', { name: /^\/help/ }).click();
  const dialog = page.locator('dialog.help-dialog[open]');
  await expectFullSize(dialog);
  await expectInsideViewport(page, dialog);
  const backdrop = await dialog.evaluate((el) => getComputedStyle(el, '::backdrop').backgroundColor);
  expect(backdrop).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  // results list actually renders rows
  expect(await dialog.locator('.help-results *').count()).toBeGreaterThan(5);
});

for (const [label, selector] of [
  ['/char', '.symbol-more-popover:not(.units-menu-popover):popover-open'],
  ['/units', '.units-menu-popover:popover-open'],
] as const) {
  test(`${label} opens like /help (full size, inside viewport, rows visible)`, async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    const pop = page.locator(selector);
    await expectFullSize(pop);
    await expectInsideViewport(page, pop);
    const list = pop.locator('.symbol-list');
    expect((await list.boundingBox())!.height, 'list is not collapsed').toBeGreaterThan(150);
    await expect(pop.locator('.symbol-list-item').first()).toBeVisible();
  });
}

test('settings currency browser lists currencies', async ({ page }) => {
  await page.locator('[data-tour-target="settings-btn"]').click();
  await page.locator('#currency-browser').click();
  const pop = page.locator('.currency-browser-popover:popover-open');
  await expect(pop).toBeVisible();
  expect((await pop.locator('.symbol-list').boundingBox())!.height).toBeGreaterThan(100);
  await expect(pop.locator('.symbol-list-item').first()).toContainText('USD');
});
