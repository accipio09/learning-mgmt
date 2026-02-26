/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak
 *
 * Rating scale: 1=Again, 2=Hard, 3=Good, 4=Easy
 */

export interface SM2State {
  ease: number;
  interval: number;
  repetitions: number;
}

export interface SM2Result extends SM2State {
  dueDate: string; // ISO date string
}

export function calculateSM2(
  state: SM2State,
  rating: number // 1-4
): SM2Result {
  // Map our 1-4 scale to SM-2's 0-5 quality scale
  // 1=Again→0, 2=Hard→2, 3=Good→4, 4=Easy→5
  const qualityMap: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const quality = qualityMap[rating] ?? 0;

  let { ease, interval, repetitions } = state;

  if (quality < 3) {
    // Failed: reset repetitions, short interval
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }
  }

  // Update ease factor (minimum 1.3)
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  // Calculate due date
  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + interval);
  const dueDate = due.toISOString().split("T")[0];

  return { ease, interval, repetitions, dueDate };
}
