import { test, expect } from '@playwright/test';

test.describe('五子棋 (Gobang)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?game=gobang');
    await page.waitForLoadState('networkidle');
  });

  test('主页应正确加载', async ({ page }) => {
    await expect(page.locator('h1:has-text("五子棋")')).toBeVisible();
  });

  test('可以切换到本地对战模式', async ({ page }) => {
    await page.click('text=本地对战');
    // 检查棋盘是否可见
    await expect(page.locator('[class*="grid"]').first()).toBeVisible();
  });

  test('可以切换到在线对战模式', async ({ page }) => {
    await page.click('text=在线对战');
    // 检查创建房间按钮是否存在
    await expect(page.locator('text=创建房间')).toBeVisible();
  });

  test('本地对战 - 可以下棋', async ({ page }) => {
    await page.click('text=本地对战');

    // 点击棋盘中心位置
    const board = page.locator('[class*="grid"]').first();
    const cells = board.locator('[class*="cursor-pointer"]');
    const centerCell = cells.nth(7 * 15 + 7); // row 7, col 7
    await centerCell.click();

    // 等待 UI 更新
    await page.waitForTimeout(100);

    // 检查下一步应该是白方
    await expect(page.locator('text=白方')).toBeVisible();
  });

  test('在线对战 - 创建房间', async ({ page }) => {
    await page.click('text=在线对战');

    // 等待连接状态变为已连接
    await expect(page.locator('text=已连接')).toBeVisible({ timeout: 10000 });

    // 点击创建房间
    await page.click('text=创建房间');

    // 检查房间号是否显示
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 });
  });
});