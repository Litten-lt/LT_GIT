import { test, expect } from '@playwright/test';

test.describe('红A (HongA)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?game=honga');
    await page.waitForLoadState('networkidle');
  });

  test('主页应正确加载', async ({ page }) => {
    await expect(page.locator('h1:has-text("红A")')).toBeVisible();
  });

  test('在线对战按钮存在', async ({ page }) => {
    // 默认应该是在线对战模式
    await expect(page.locator('text=在线对战').first()).toBeVisible();
  });

  test('可以切换到本地模式', async ({ page }) => {
    await page.click('text=本地游戏');
    // 本地模式提示开发中
    await expect(page.locator('text=开发中')).toBeVisible();
  });
});

test.describe('首页', () => {
  test('应显示游戏列表', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=游戏中心')).toBeVisible();
    await expect(page.locator('text=五子棋')).toBeVisible();
    await expect(page.locator('text=红A')).toBeVisible();
  });

  test('点击游戏可以进入', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('text=开始游戏 >> nth=0');
    await page.waitForLoadState('networkidle');

    // 应该跳转到游戏页面
    await expect(page).toHaveURL(/game=gobang/);
  });
});