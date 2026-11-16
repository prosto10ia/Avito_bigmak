import { expect, test } from '@playwright/test';

test('opens dashboard and navigates through five tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Путь стажёра')).toBeVisible();
  for (const label of ['Путь', 'AI-помощник', 'Календарь', 'Профиль', 'Домой']) {
    await page.getByRole('link', { name: label }).click();
    await expect(page.locator('main')).toBeVisible();
  }
});
