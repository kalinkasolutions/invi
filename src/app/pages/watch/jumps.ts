const jumpSteps = [5, 10, 15, 20, 30];

/** Seconds for the n-th jump in a row (1-based): 5, 10, 15, 20, then 30 for every further one. */
export function jumpSeconds(jumpNumber: number): number {
  return jumpSteps[Math.min(Math.max(jumpNumber, 1), jumpSteps.length) - 1];
}

export type TapZone = 'back' | 'middle' | 'forward';

/** The third of the video a tap landed in. */
export function tapZone(x: number, width: number): TapZone {
  const position = x / width;
  return position < 1 / 3 ? 'back' : position > 2 / 3 ? 'forward' : 'middle';
}
