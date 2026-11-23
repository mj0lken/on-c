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

for (const [label, selector, closeLabel] of [
  ['/char', '.symbol-more-popover:not(.units-menu-popover):popover-open', 'Close symbols'],
  ['/units', '.units-menu-popover:popover-open', 'Close units'],
] as const) {
  test(`${label} opens like /help (full size, inside viewport, rows visible, close × works)`, async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    const pop = page.locator(selector);
    await expectFullSize(pop);
    await expectInsideViewport(page, pop);
    const list = pop.locator('.symbol-list');
    expect((await list.boundingBox())!.height, 'list is not collapsed').toBeGreaterThan(150);
    await expect(pop.locator('.symbol-list-item').first()).toBeVisible();

    const closeBtn = pop.getByRole('button', { name: closeLabel });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(pop).toBeHidden();
  });
}

test('tab close × is rendered inside the tab pill and closes the tab', async ({ page }) => {
  await page.getByRole('button', { name: 'New sheet tab' }).click();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);

  const selectedTab = page.locator('.tab-btn[aria-selected="true"]');
  const closeBtn = page.locator('.tab-pill:has(> .tab-btn[aria-selected="true"]) > .tab-close-btn');
  await expect(closeBtn).toBeVisible();

  const tabBox = (await selectedTab.boundingBox())!;
  const closeBox = (await closeBtn.boundingBox())!;
  // Close button sits inside the tab pill bounds rather than outside it
  expect(closeBox.x).toBeGreaterThanOrEqual(tabBox.x);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(tabBox.x + tabBox.width);
  expect(closeBox.y).toBeGreaterThanOrEqual(tabBox.y);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(tabBox.y + tabBox.height);

  await closeBtn.click();
  await expect(tabs).toHaveCount(1);
});

test('settings currency browser lists currencies', async ({ page }) => {
  await page.locator('[data-tour-target="settings-btn"]').click();
  await page.locator('#currency-browser').click();
  const pop = page.locator('.currency-browser-popover:popover-open');
  await expect(pop).toBeVisible();
  expect((await pop.locator('.symbol-list').boundingBox())!.height).toBeGreaterThan(100);
  await expect(pop.locator('.symbol-list-item').first()).toContainText('USD');
});
