import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseDifficulty, testIds } from './support/game';

/**
 * R16/P0-3 — two genuinely independent browsers (separate contexts, no
 * shared storage/cookies/tokens) join the same async challenge, submit
 * separate answers, and both show up correctly on the public leaderboard.
 */

async function playFullSoloGame(page: Page): Promise<string> {
  await page.goto('/');
  // Easy -> list mode, which this spec's candidate-click flow drives.
  await chooseDifficulty(page, 'easy');
  await page.getByRole('button', { name: /start/i }).click();

  let lastResultId = '';
  for (let round = 1; round <= 5; round += 1) {
    await expect(
      page.getByRole('heading', { level: 2, name: 'Round ' + round }),
    ).toBeVisible();
    await page.getByTestId(testIds.candidateItem).first().click();
    const [guessResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/guess') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Submit guess' }).click(),
    ]);
    const guess = (await guessResponse.json()) as { resultId: string };
    lastResultId = guess.resultId;
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
    await page.getByTestId('advance').click();
  }

  await expect(page.getByTestId('results-view')).toBeVisible();
  // The final score is displayed once all five rounds are complete.
  await expect(page.getByTestId('total-score')).toHaveText(/\d+/);
  return lastResultId;
}

test('two independent browsers join the same challenge and both appear on the leaderboard', async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  try {
    const resultAId = await playFullSoloGame(pageA);
    const tokenA = await pageA.evaluate(() => localStorage.getItem('terraguessr.playerToken'));
    expect(tokenA).toBeTruthy();
    const resultAResponse = await pageA.request.get('/api/results/' + resultAId, {
      headers: { 'X-Player-Token': tokenA! },
    });
    expect(resultAResponse.status()).toBe(200);
    const resultA = (await resultAResponse.json()) as {
      actual: { lat: number; lon: number };
      guess: { lat: number; lon: number };
    };

    // Player A shares their just-finished game as a challenge.
    await pageA.getByTestId('create-challenge').click();
    const shareUrlInput = pageA.getByTestId('share-url');
    await expect(shareUrlInput).toBeVisible();
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toMatch(/^\/challenge\//);

    await pageA.getByTestId('display-name').fill('Alice');
    await pageA.getByTestId('join-challenge').click();
    await expect(pageA.getByTestId('join-result')).toContainText(/ranked #/i);

    // Player B: a brand-new browser context — no cookies, no localStorage,
    // no shared player token with A — opens the share link directly.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      const [joinResponse] = await Promise.all([
        pageB.waitForResponse((response) => response.url().endsWith('/join') && response.request().method() === 'POST'),
        pageB.goto(shareUrl),
      ]);
      expect(joinResponse.status()).toBe(201);
      const joined = (await joinResponse.json()) as {
        playerToken: string;
        round: { roundId: string; candidates: Array<{ lat: number; lon: number }> };
      };
      expect(joined.playerToken).not.toBe(tokenA);

      await expect(pageB.getByTestId('challenge-join-flow')).toBeVisible();
      await expect(
        pageB.getByRole('heading', { level: 2, name: 'Round 1' }),
      ).toBeVisible();

      // R04: the shared round never leaks the actual location before B submits.
      await expect(pageB.getByTestId(testIds.revealView)).toHaveCount(0);

      const forbiddenResult = await pageB.request.get('/api/results/' + resultAId, {
        headers: { 'X-Player-Token': joined.playerToken },
      });
      expect(forbiddenResult.status()).toBe(404);
      const forbiddenRound = await pageA.request.get('/api/rounds/' + joined.round.roundId, {
        headers: { 'X-Player-Token': tokenA! },
      });
      expect(forbiddenRound.status()).toBe(404);

      const differentCandidate = joined.round.candidates.findIndex(
        (candidate) => candidate.lat !== resultA.guess.lat || candidate.lon !== resultA.guess.lon,
      );
      expect(differentCandidate).toBeGreaterThanOrEqual(0);
      await pageB.getByTestId(testIds.candidateItem).nth(differentCandidate).click();
      const [guessBResponse] = await Promise.all([
        pageB.waitForResponse((response) => response.url().includes('/guess') && response.request().method() === 'POST'),
        pageB.getByRole('button', { name: 'Submit guess' }).click(),
      ]);
      await expect(pageB.getByTestId(testIds.revealView)).toBeVisible();
      const guessB = (await guessBResponse.json()) as {
        resultId: string;
        actual: { lat: number; lon: number };
      };
      expect(guessB.actual).toEqual(resultA.actual);
      const resultBResponse = await pageB.request.get('/api/results/' + guessB.resultId, {
        headers: { 'X-Player-Token': joined.playerToken },
      });
      expect(resultBResponse.status()).toBe(200);
      const resultB = (await resultBResponse.json()) as { guess: { lat: number; lon: number } };
      expect(resultB.guess).not.toEqual(resultA.guess);

      await pageB.getByTestId('display-name').fill('Bob');
      await pageB.getByTestId('join-challenge').click();
      await expect(pageB.getByTestId('join-result')).toContainText(/ranked #/i);

      const rows = await pageB.getByTestId('leaderboard-row').allTextContents();
      expect(rows.some((row) => row.includes('Alice'))).toBe(true);
      expect(rows.some((row) => row.includes('Bob'))).toBe(true);
      expect(rows).toHaveLength(2);
    } finally {
      await contextB.close();
    }
  } finally {
    await contextA.close();
  }
});
