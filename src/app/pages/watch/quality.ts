import { readStored, writeStored } from '../../core/storage';

const qualityKey = 'invi.quality';
export const autoQuality = 0;

/** The quality chosen last time, as a height like 1080, or autoQuality. */
export function savedQuality(): number {
  return Number(readStored(qualityKey)) || autoQuality;
}

export function saveQuality(height: number): void {
  writeStored(qualityKey, height === autoQuality ? null : String(height));
}

/** The best of `available` that isn't above `wanted`; the lowest one when all are above it. */
export function closestQuality(available: number[], wanted: number): number | undefined {
  if (!available.length) {
    return undefined;
  }
  const fitting = available.filter((height) => height <= wanted);
  return fitting.length ? Math.max(...fitting) : Math.min(...available);
}
