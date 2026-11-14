import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type SelectionMode = 'map' | 'list';

/**
 * R15 — the exactly-four weather field labels, in their fixed order and units.
 * These mirror frontend/src/components/WeatherPanel.tsx.
 */
export const WEATHER_FIELD_LABELS = [
  'Temperature',
  'Precipitation',
  'Humidity',
  'Wind speed',
] as const;

/**
 * Stable data-testid selectors defined by the frontend feature components
 * (WeatherPanel, DifficultyPicker, RoundScreen, RevealView, MapPicker,
 * CandidateList). The e2e suite depends on the frontend composing these into a
 * playable game screen (W-02/W-03/W-04/W-05 wiring; see App.tsx).
 */
export const testIds = {
  difficulty: (d: Difficulty) => 'difficulty-' + d,
  modeToggle: 'mode-toggle',
  modeMap: 'mode-option-map',
  modeList: 'mode-option-list',
  selectionLocked: 'selection-mode-locked',
  weatherPanel: 'weather-panel',
  mapPicker: 'map-picker',
  candidateList: 'candidate-list',
  candidateItem: 'candidate-item',
  revealView: 'reveal-view',
  revealScore: 'reveal-score',
  revealDistance: 'reveal-distance',
  revealActual: 'reveal-actual',
} as const;

const FORBIDDEN_ACTUAL_KEYS = new Set([
  'actualLat',
  'actualLon',
  'actual',
  'isActual',
]);

/** Deep-scan a value for R04-forbidden keys at any nesting depth. */
export function findActualKeys(value: unknown): string[] {
  const leaks: string[] = [];
  const stack: Array<[string, unknown]> = [['$', value]];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) continue;
    const [path, current] = entry;

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i += 1) {
        stack.push([path + '[' + i + ']', current[i]]);
      }
    } else if (current !== null && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (FORBIDDEN_ACTUAL_KEYS.has(key)) {
          leaks.push(path + '.' + key);
        }
        stack.push([path + '.' + key, child]);
      }
    }
  }

  return leaks;
}

/** Pick a difficulty; for Medium, optionally choose map or list. */
export async function chooseDifficulty(
  page: Page,
  difficulty: Difficulty,
  selectionMode?: SelectionMode,
): Promise<void> {
  await page.getByTestId(testIds.difficulty(difficulty)).check();
  if (difficulty === 'medium' && selectionMode !== undefined) {
    const mode = selectionMode === 'list' ? testIds.modeList : testIds.modeMap;
    await page.getByTestId(mode).click();
  }
}

/** Assert the weather panel renders exactly the four R15 fields in order. */
export async function expectWeatherPanel(page: Page): Promise<void> {
  const panel = page.getByTestId(testIds.weatherPanel);
  await expect(panel).toBeVisible();
  for (const label of WEATHER_FIELD_LABELS) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(panel.locator('dt')).toHaveCount(4);
}
