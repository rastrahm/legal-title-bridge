/**
 * Deadline / hardDeadline countdown helpers for cartera.
 */

export type DeadlinePhase = "before_deadline" | "before_hard" | "past_hard";

export interface DeadlineSnapshot {
  phase: DeadlinePhase;
  secondsToDeadline: number;
  secondsToHardDeadline: number;
}

/**
 * Compute countdown phase relative to `now` (unix seconds).
 */
export function snapshotDeadlines(
  deadline: number,
  hardDeadline: number,
  now: number,
): DeadlineSnapshot {
  const secondsToDeadline = deadline - now;
  const secondsToHardDeadline = hardDeadline - now;
  let phase: DeadlinePhase;
  if (now < deadline) phase = "before_deadline";
  else if (now < hardDeadline) phase = "before_hard";
  else phase = "past_hard";
  return { phase, secondsToDeadline, secondsToHardDeadline };
}

/**
 * Format remaining seconds as Hh Mm Ss (non-negative clamp).
 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
