import { test } from '@playwright/test';
import { chooseDifficulty, testIds } from './support/game';

const DIR = 'test-results/evidence';

test('capture evidence screenshots', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: `${DIR}/01-home.png`, fullPage: true });

  await chooseDifficulty(page, 'medium', 'list');
  await page.getByRole('button', { name: /start/i }).click();
  await page.getByTestId(testIds.candidateList).waitFor();
  await page.screenshot({ path: `${DIR}/02-round-weather-list.png`, fullPage: true });

  await page.getByTestId(testIds.candidateItem).first().click();
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await page.getByTestId(testIds.revealView).waitFor();
  await page.screenshot({ path: `${DIR}/03-reveal.png`, fullPage: true });

});

test('capture tutorial dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('how-to-play').click();
  await page.getByTestId('tutorial-dialog').waitFor();
  await page.screenshot({ path: `${DIR}/04-tutorial.png`, fullPage: true });
});

test('capture results + challenge share + leaderboard', async ({ page }) => {
  await page.goto('/');
  await chooseDifficulty(page, 'easy');
  await page.getByRole('button', { name: /start/i }).click();
  for (let round = 1; round <= 5; round += 1) {
    await page.getByTestId(testIds.candidateItem).first().click();
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await page.getByTestId(testIds.revealView).waitFor();
    await page.getByTestId('advance').click();
  }
  await page.getByTestId('results-view').waitFor();
  await page.screenshot({ path: `${DIR}/05-results.png`, fullPage: true });

  await page.getByTestId('create-challenge').click();
  await page.getByTestId('share-url').waitFor();
  await page.getByTestId('display-name').fill('Alice');
  await page.getByTestId('join-challenge').click();
  await page.getByTestId('join-result').waitFor();
  await page.screenshot({ path: `${DIR}/06-challenge-leaderboard.png`, fullPage: true });
});
