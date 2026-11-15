const DAY_MS = 86_400_000;

function dayOrdinal(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;
}

/** Current streak counts through today, or through yesterday if today's play is pending. */
export function calculateDailyStreaks(dates: readonly string[], today = new Date().toISOString().slice(0, 10)) {
  const ordinals = [...new Set(dates)].sort().map(dayOrdinal);
  if (ordinals.length === 0) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let index = 1; index < ordinals.length; index += 1) {
    run = ordinals[index] === ordinals[index - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const completed = new Set(ordinals);
  const todayOrdinal = dayOrdinal(today);
  let expected = completed.has(todayOrdinal) ? todayOrdinal : todayOrdinal - 1;
  let current = 0;
  while (completed.has(expected)) { current += 1; expected -= 1; }
  return { current, longest };
}
