import { expect, test } from '@playwright/test';
import { chooseDifficulty, expectWeatherPanel } from './support/game';

const weatherUrl = process.env.PLAYWRIGHT_WEATHER_URL || 'http://localhost:4001';

test('a failed weather fetch falls back to another location in the browser (R13)', async ({ page, request }) => {
  const beforeResponse = await request.get(weatherUrl + '/__test__/stats');
  expect(beforeResponse.ok()).toBe(true);
  const before = (await beforeResponse.json()) as { failuresServed: number };

  // The weather client retries three times after the initial request. Fail
  // all four attempts so the service must select another location (R13).
  expect((await request.post(weatherUrl + '/__test__/fail-next?count=4')).status()).toBe(204);

  await page.goto('/');
  await chooseDifficulty(page, 'easy');
  await page.getByRole('button', { name: /start/i }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Round 1' })).toBeVisible();
  await expectWeatherPanel(page);

  await page.getByTestId('candidate-item').first().click();
  const [guessResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/guess') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Submit guess' }).click(),
  ]);
  const guess = (await guessResponse.json()) as { actual: { lat: number; lon: number } };

  const afterResponse = await request.get(weatherUrl + '/__test__/stats');
  const after = (await afterResponse.json()) as {
    failuresServed: number;
    lastFailedCoordinates: { lat: number; lon: number };
  };
  expect(after.failuresServed).toBe(before.failuresServed + 4);
  expect(guess.actual).not.toEqual(after.lastFailedCoordinates);
});
