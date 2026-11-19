"use client";

import { useEffect, useState } from "react";

import {
  formatCountdown,
  snapshotDeadlines,
  type DeadlineSnapshot,
} from "@/lib/deadlines";

/**
 * Live countdown between deadline and hardDeadline.
 */
export function useDeadlineCountdown(
  deadline: number,
  hardDeadline: number,
  nowProvider: () => number = () => Math.floor(Date.now() / 1000),
): DeadlineSnapshot & { label: string } {
  const [snap, setSnap] = useState(() =>
    snapshotDeadlines(deadline, hardDeadline, nowProvider()),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSnap(snapshotDeadlines(deadline, hardDeadline, nowProvider()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline, hardDeadline, nowProvider]);

  const label =
    snap.phase === "before_deadline"
      ? formatCountdown(snap.secondsToDeadline)
      : snap.phase === "before_hard"
        ? formatCountdown(snap.secondsToHardDeadline)
        : "0h 0m 0s";

  return { ...snap, label };
}
