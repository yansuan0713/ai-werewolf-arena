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
  await expect(page.locator('.phase-brief')).toContainText('分别收集狼人意图');
  await expect(page.locator('article.action-panel')).toHaveCount(2);
  await expect(page.locator('.phase-rail [aria-current="step"]')).toContainText('夜幕');
  await expect(page.getByText('行动进度').locator('..')).toContainText('0/2');
  await expect(page.locator('.pending-queue button')).toHaveCount(2);
  await page.getByRole('button', { name: '前往行动' }).click();
  await expect(page.locator('#action-desk')).toBeVisible();
  await expect(page.getByRole('tab', { name: /公共/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('搜索当前日志').fill('绝对不存在的日志内容');
  await expect(page.getByText('没有匹配的日志')).toBeVisible();
  await page.getByRole('button', { name: '清除日志搜索' }).click();
  await expect(page.getByLabel('搜索当前日志')).toHaveValue('');

  await page.getByRole('button', { name: '隐私遮罩' }).click();
  await expect(page.getByRole('dialog')).toContainText('上帝视角已遮挡');
  await page.getByRole('button', { name: '返回控制台' }).click();
  await expect(page.getByRole('heading', { name: '狼人行动' })).toBeVisible();

  const firstWolf = page.locator('article.action-panel').first();
  await expect(firstWolf.locator('.action-steps [aria-current="step"]')).toContainText('提示词');
  await firstWolf.getByRole('button', { name: '生成并复制提示词' }).click();
  await expect(firstWolf.getByLabel('生成的玩家提示词')).not.toHaveValue('');
  await expect(firstWolf.locator('.action-steps [aria-current="step"]')).toContainText('AI 回复');
  await firstWolf.getByLabel('粘贴 AI 回复').fill('【击杀：3号】');
  await expect(firstWolf.locator('.action-steps [aria-current="step"]')).toContainText('确认行动');
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

test('爆炸项圈可以建局、确认私密线索并提交开场发言', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建爆炸项圈' }).click();
  await expect(page.getByRole('heading', { name: '新建爆炸项圈' })).toBeVisible();
  await page.getByLabel('爆炸项圈玩家人数').selectOption('4');
  await page.getByRole('button', { name: '创建并检查项圈' }).click();
  await expect(page.getByText('逐一确认私人线索')).toBeVisible();
  await expect(page.getByText('爆炸项圈 · 爆炸项圈 · 生存局')).toBeVisible();

  const gameId = await page.evaluate(() => localStorage.getItem('ai-werewolf-current-game'));
  const stored = await (await page.request.get(`/api/games/${gameId}`)).json();
  expect(stored.mode).toBe('exploding_collar');
  expect(stored.players).toHaveLength(4);
  await expect(page.locator('article.briefing-card')).toHaveCount(4);
  const firstBriefing = page.locator('article.briefing-card').first();
  await firstBriefing.getByRole('button', { name: '生成私人简报' }).click();
  await firstBriefing.getByText('检查简报内容').click();
  await expect(firstBriefing.getByLabel('1号私人简报')).toHaveValue(/私人扫描/);
  page.once('dialog', (dialog) => dialog.accept());
  await firstBriefing.getByRole('button', { name: '确认已交接' }).click();
  await expect(firstBriefing).toHaveClass(/confirmed/);

  for (let index = 1; index < 4; index += 1) {
    const briefing = page.locator('article.briefing-card').nth(index);
    await briefing.getByRole('button', { name: '生成私人简报' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await briefing.getByRole('button', { name: '确认已交接' }).click();
  }
  await expect(page.getByText('逐一确认私人线索 · 4/4')).toBeVisible();

  await page.getByRole('button', { name: '私人线路 已隐藏' }).click();
  await expect(page.getByText(/致命：/).first()).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '推进至下一阶段' }).click();
  await expect(page.getByRole('heading', { name: '开场陈述' })).toBeVisible();
  await expect(page.locator('.phase-brief')).toContainText('每名存活玩家完成一段公开开场陈述');
  await expect(page.locator('article.collar-action-panel')).toHaveCount(4);

  const firstPlayer = page.locator('article.collar-action-panel').first();
  await firstPlayer.getByRole('button', { name: '生成并复制提示词' }).click();
  await expect(firstPlayer.getByLabel('项圈玩家提示词')).toHaveValue(/你的项圈已确认安全线/);
  await firstPlayer.getByLabel('粘贴 AI 回复').fill('【公开发言】我会谨慎交换安全线索。');
  await firstPlayer.getByRole('button', { name: '解析回复' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await firstPlayer.getByRole('button', { name: '确认并提交行动' }).click();
  await expect(page.locator('article.collar-action-panel')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('article.collar-action-panel')).toHaveCount(3);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '撤销上一步' }).click();
  await expect(page.locator('article.collar-action-panel')).toHaveCount(4);

  const opening = await (await page.request.get(`/api/games/${gameId}`)).json();
  for (const player of opening.players) {
    const response = await page.request.post(`/api/collar-games/${gameId}/actions`, {
      data: {
        playerId: player.id,
        raw: `【公开发言】${player.seat}号开场`,
        action: {
          kind: 'collar_speech',
          text: `${player.seat}号开场`,
          matched: `【公开发言】${player.seat}号开场`,
        },
      },
    });
    expect(response.ok()).toBe(true);
  }
  expect((await page.request.post(`/api/collar-games/${gameId}/advance`, { data: {} })).ok()).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: '操作者发言' })).toBeVisible();

  let activePanel = page.locator('article.collar-action-panel').first();
  await activePanel.getByLabel('粘贴 AI 回复').fill('【公开发言】我选择测试二号的线路。');
  await activePanel.getByRole('button', { name: '解析回复' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await activePanel.getByRole('button', { name: '确认并提交行动' }).click();
  await page.getByRole('button', { name: '推进至下一阶段' }).click();
  await expect(page.getByRole('heading', { name: '选择剪线' })).toBeVisible();

  activePanel = page.locator('article.collar-action-panel').first();
  await activePanel.getByLabel('粘贴 AI 回复').fill('【剪线：2号-红】');
  await activePanel.getByRole('button', { name: '解析回复' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await activePanel.getByRole('button', { name: '确认并提交行动' }).click();
  await page.getByRole('button', { name: '推进至下一阶段' }).click();
  await expect(page.getByRole('heading', { name: '目标应对' })).toBeVisible();

  activePanel = page.locator('article.collar-action-panel').first();
  await activePanel.getByLabel('粘贴 AI 回复').fill('【使用保险】');
  await activePanel.getByRole('button', { name: '解析回复' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await activePanel.getByRole('button', { name: '确认并提交行动' }).click();
  await page.getByRole('button', { name: '推进至下一阶段' }).click();
  await expect(page.getByRole('heading', { name: '公开结算' })).toBeVisible();
  await expect(page.getByText(/启动保险/)).toBeVisible();
  await page.getByRole('button', { name: '推进至下一阶段' }).click();
  await expect(page.getByRole('heading', { name: '操作者发言' })).toBeVisible();
  await expect(page.getByText('第 2 轮 · 当前阶段')).toBeVisible();
});
