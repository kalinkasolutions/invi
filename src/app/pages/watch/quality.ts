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

interface Size {
  width: number | null;
  height: number | null;
}

interface Variant extends Size {
  active: boolean;
  audioId: number | null;
}

/** The shorter side, as YouTube names qualities: a vertical 1080×1920 video is 1080p. */
export function qualityOf(size: Size): number {
  return Math.min(size.width ?? Infinity, size.height ?? Infinity);
}

/** The qualities a video offers, best first. */
export function qualitiesOf(variants: Size[]): number[] {
  const qualities = variants.map(qualityOf).filter(Number.isFinite);
  return [...new Set(qualities)].sort((a, b) => b - a);
}

/**
 * The picture-and-sound combination with this quality and the sound that plays now. Taking just
 * any one with the quality would switch to whichever audio comes first, often an AI dub.
 */
export function variantWithQuality<T extends Variant>(variants: T[], quality: number): T | undefined {
  const playingAudio = variants.find((variant) => variant.active)?.audioId;
  const matching = variants.filter((variant) => qualityOf(variant) === quality);
  return matching.find((variant) => variant.audioId === playingAudio) ?? matching[0];
}
