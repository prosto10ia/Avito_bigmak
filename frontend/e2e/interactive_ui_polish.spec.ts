import { expect, test } from '@playwright/test';

test('opens a dashboard task and its roadmap details', async ({ page }) => {
  await page.goto('/');
  const task = page.getByRole('link', { name: /Открыть шаг/ }).first();
  await expect(task).toBeVisible();
  await task.click();
  await expect(page).toHaveURL(/\/roadmap\?node=/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('navigates calendar months and opens an event', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Календарь' })).toBeVisible();
  const event = page.getByRole('button', { name: /Открыть событие: 1:1 с buddy/ });
  await expect(event).toBeVisible();
  await event.click();
  await expect(page.getByRole('dialog')).toContainText('Первые вопросы и план на неделю');
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await page.getByRole('button', { name: 'Следующий месяц' }).click();
  await page.getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('heading', { name: /Календарь/ })).toBeVisible();
});
