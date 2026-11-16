import { expect, test } from '@playwright/test';

test('shows stage 2-5 controls in browser fallback', async ({ page }) => {
  await page.goto('/roadmap');
  await expect(page.getByRole('heading', { name: 'Дорожная карта' })).toBeVisible();
  await page.getByRole('link', { name: 'AI-помощник' }).click();
  await expect(page.getByRole('button', { name: 'Запросить доступ в Jira' })).toBeVisible();
  await page.getByRole('link', { name: 'Календарь' }).click();
  await expect(page.getByRole('heading', { name: 'Календарь' })).toBeVisible();
  await page.getByRole('link', { name: 'Профиль' }).click();
  await expect(page.getByText('hack-and-change-2026')).toBeVisible();
});
