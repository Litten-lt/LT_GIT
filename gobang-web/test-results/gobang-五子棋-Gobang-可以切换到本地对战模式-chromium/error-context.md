# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gobang.spec.ts >> 五子棋 (Gobang) >> 可以切换到本地对战模式
- Location: tests\e2e\gobang.spec.ts:13:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_CLOSED at https://chesshub.fun/?game=gobang
Call log:
  - navigating to "https://chesshub.fun/?game=gobang", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('五子棋 (Gobang)', () => {
  4  |   test.beforeEach(async ({ page }) => {
> 5  |     await page.goto('/?game=gobang');
     |                ^ Error: page.goto: net::ERR_CONNECTION_CLOSED at https://chesshub.fun/?game=gobang
  6  |     await page.waitForLoadState('networkidle');
  7  |   });
  8  | 
  9  |   test('主页应正确加载', async ({ page }) => {
  10 |     await expect(page.locator('h1:has-text("五子棋")')).toBeVisible();
  11 |   });
  12 | 
  13 |   test('可以切换到本地对战模式', async ({ page }) => {
  14 |     await page.click('text=本地对战');
  15 |     // 检查棋盘是否可见
  16 |     await expect(page.locator('[class*="grid"]').first()).toBeVisible();
  17 |   });
  18 | 
  19 |   test('可以切换到在线对战模式', async ({ page }) => {
  20 |     await page.click('text=在线对战');
  21 |     // 检查创建房间按钮是否存在
  22 |     await expect(page.locator('text=创建房间')).toBeVisible();
  23 |   });
  24 | 
  25 |   test('本地对战 - 可以下棋', async ({ page }) => {
  26 |     await page.click('text=本地对战');
  27 | 
  28 |     // 点击棋盘中心位置
  29 |     const board = page.locator('[class*="grid"]').first();
  30 |     const cells = board.locator('[class*="cursor-pointer"]');
  31 |     const centerCell = cells.nth(7 * 15 + 7); // row 7, col 7
  32 |     await centerCell.click();
  33 | 
  34 |     // 等待 UI 更新
  35 |     await page.waitForTimeout(100);
  36 | 
  37 |     // 检查下一步应该是白方
  38 |     await expect(page.locator('text=白方')).toBeVisible();
  39 |   });
  40 | 
  41 |   test('在线对战 - 创建房间', async ({ page }) => {
  42 |     await page.click('text=在线对战');
  43 | 
  44 |     // 等待连接状态变为已连接
  45 |     await expect(page.locator('text=已连接')).toBeVisible({ timeout: 10000 });
  46 | 
  47 |     // 点击创建房间
  48 |     await page.click('text=创建房间');
  49 | 
  50 |     // 检查房间号是否显示
  51 |     await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 });
  52 |   });
  53 | });
```