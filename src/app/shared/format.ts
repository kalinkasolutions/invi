const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCount(count: number | undefined): string {
  return count === undefined ? '' : compactNumber.format(count);
}

export function formatDuration(totalSeconds: number | undefined): string {
  if (!totalSeconds) {
    return '';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Reads YouTube's `t` parameter: `90`, `90s` or `1h2m3s`. */
export function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  if (/^\d+s?$/.test(value)) {
    return parseInt(value, 10);
  }
  const parts = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!parts) {
    return 0;
  }
  const [, hours = '0', minutes = '0', seconds = '0'] = parts;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function joinNonEmpty(parts: (string | undefined)[], separator = ' · '): string {
  return parts.filter((part) => !!part).join(separator);
}
