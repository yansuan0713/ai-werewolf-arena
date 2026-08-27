import { expect, test } from '@playwright/test';

test('两名狼人依次提交、刷新恢复并可撤销', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建 7 人对局' }).click();
  await page.getByRole('button', { name: '手动分配身份' }).click();
  await expect(page.getByLabel('首夜允许女巫自救')).toBeChecked();
  await expect(page.getByLabel('死亡时公开身份')).not.toBeChecked();
  await page.getByLabel('首夜允许女巫自救').uncheck();
  await page.getByLabel('死亡时公开身份').check();
  await page.getByRole('button', { name: '创建并确认身份' }).click();
  await expect(page.getByText('正式开始前身份确认')).toBeVisible();
  const gameId = await page.evaluate(() => localStorage.getItem('ai-werewolf-current-game'));
  const stored = await (await page.request.get(`/api/games/${gameId}`)).json();
  expect(stored.config.firstNightSelfSave).toBe(false);
  expect(stored.config.revealOnDeath).toBe(true);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /推进至下一阶段/ }).click();
  await expect(page.getByRole('heading', { name: '狼人行动' })).toBeVisible();
  await expect(page.locator('article.action-panel')).toHaveCount(2);
  await expect(page.locator('.phase-rail [aria-current="step"]')).toContainText('夜幕');
  await expect(page.getByText('行动进度').locator('..')).toContainText('0/2');

  await page.getByRole('button', { name: '隐私遮罩' }).click();
  await expect(page.getByRole('dialog')).toContainText('上帝视角已遮挡');
  await page.getByRole('button', { name: '返回控制台' }).click();
  await expect(page.getByRole('heading', { name: '狼人行动' })).toBeVisible();

  const firstWolf = page.locator('article.action-panel').first();
  await firstWolf.getByLabel('粘贴 AI 回复').fill('【击杀：3号】');
  await firstWolf.getByRole('button', { name: '解析回复' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await firstWolf.getByRole('button', { name: '确认并提交行动' }).click();

  await expect(page.locator('article.action-panel')).toHaveCount(1);
  await expect(page.getByText('等待 2号', { exact: true })).toBeVisible();
  await expect(page.getByText('行动进度').locator('..')).toContainText('1/2');
  await page.reload();
  await expect(page.locator('article.action-panel')).toHaveCount(1);
  await expect(page.getByText('等待 2号', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '撤销上一步' }).click();
  await expect(page.locator('article.action-panel')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '撤销上一步' })).toHaveCount(0);

  const backup = await (await page.request.get(`/api/games/${gameId}/export/save`)).text();
  await page.getByRole('button', { name: '对局大厅' }).click();
  await page.getByLabel('选择要导入的完整存档').setInputFiles({
    name: 'game-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.locator('article.action-panel')).toHaveCount(2);
  const importedId = await page.evaluate(() => localStorage.getItem('ai-werewolf-current-game'));
  expect(importedId).not.toBe(gameId);
  const imported = await (await page.request.get(`/api/games/${importedId}`)).json();
  expect(imported.title).toContain('（导入）');
  expect(imported.players.map((player: { id: string }) => player.id)).not.toEqual(
    stored.players.map((player: { id: string }) => player.id),
  );
});
