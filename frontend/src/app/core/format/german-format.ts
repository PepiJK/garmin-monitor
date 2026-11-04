/**
 * German (de-DE / de-AT) formatting utilities for dates, 24h times, and numbers
 * with English labels and units.
 */

const ENGLISH_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const GERMAN_WEEKDAYS_FULL = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;

/**
 * Returns the full German weekday name ('Montag' .. 'Sonntag') for an ISO date ('YYYY-MM-DD').
 */
export function formatGermanWeekdayFull(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return GERMAN_WEEKDAYS_FULL[utcDate.getUTCDay()];
  }
  return '-';
}

const germanIntFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const germanDec1Formatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const germanDec2Formatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an ISO date string ('YYYY-MM-DD' or ISO timestamp) as German 'DD.MM.YYYY'.
 */
export function formatGermanDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    return `${m[3]}.${m[2]}.${m[1]}`;
  }
  return isoDate;
}

/**
 * Formats an ISO date string ('YYYY-MM-DD') with English 3-letter weekday and German 'DD.MM.YYYY' ('Mon, 02.11.2026').
 */
export function formatGermanDateWithWeekday(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = ENGLISH_WEEKDAYS[utcDate.getUTCDay()];
    return `${weekday}, ${m[3]}.${m[2]}.${m[1]}`;
  }
  return isoDate;
}

/**
 * Formats an ISO date string ('YYYY-MM-DD') as compact German 'DD.MM.' for chart axes and badges.
 */
export function formatGermanShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    return `${m[3]}.${m[2]}.`;
  }
  return isoDate;
}

/**
 * Formats an ISO UTC/offset timestamp into German local date and 24-hour time ('DD.MM.YYYY, HH:mm').
 */
export function formatGermanDateTime(
  isoTimestamp: string | null | undefined,
  timeZone = 'Europe/Vienna',
): string {
  if (!isoTimestamp) {
    return '-';
  }
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) {
    return formatGermanDate(isoTimestamp);
  }
  const parts = new Intl.DateTimeFormat('de-AT', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);

  const lookup: Record<string, string> = {};
  for (const p of parts) {
    lookup[p.type] = p.value;
  }
  const day = lookup['day'] ?? '01';
  const month = lookup['month'] ?? '01';
  const year = lookup['year'] ?? '1970';
  const hour = lookup['hour'] === '24' ? '00' : (lookup['hour'] ?? '00');
  const minute = lookup['minute'] ?? '00';
  return `${day}.${month}.${year}, ${hour}:${minute}`;
}

/**
 * Extracts English weekday, German local date, and 24-hour time from a Garmin start_time_local string ('Mon, 02.11.2026, 06:30').
 */
export function formatGermanLocalStartTime(
  startTimeLocal: string | null | undefined,
  fallbackDate?: string | null,
): string {
  if (!startTimeLocal) {
    return formatGermanDateWithWeekday(fallbackDate);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(startTimeLocal.trim());
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = ENGLISH_WEEKDAYS[utcDate.getUTCDay()];
    return `${weekday}, ${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}`;
  }
  return formatGermanDateWithWeekday(fallbackDate ?? startTimeLocal);
}

/**
 * Formats an ISO week label ('2026-W45') into compact week label ('W45').
 */
export function formatGermanIsoWeek(isoWeekLabel: string | null | undefined): string {
  if (!isoWeekLabel) {
    return '-';
  }
  const m = /^(\d{4})-W(\d{2})$/i.exec(isoWeekLabel.trim());
  if (m) {
    return `W${m[2]}`;
  }
  return isoWeekLabel;
}

/**
 * Formats a number using German locale conventions (comma decimal, dot thousands separator).
 */
export function formatGermanNumber(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return '-';
  }
  if (decimals === 0) {
    return germanIntFormatter.format(Math.round(val));
  }
  if (decimals === 1) {
    return germanDec1Formatter.format(val);
  }
  if (decimals === 2) {
    return germanDec2Formatter.format(val);
  }
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

/**
 * Formats minutes as hours & minutes ('7h 45m' or '45m').
 */
export function formatGermanHoursMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) {
    return '-';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) {
    return `${mins}m`;
  }
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

/**
 * Formats running pace in min/km ('5:20 /km') from explicit pace string, seconds/km, or duration & distance.
 */
export function formatRunningPace(
  avgPaceMinPerKm?: string | null,
  avgPaceSecPerKm?: number | null,
  durationMin?: number | null,
  distanceKm?: number | null,
): string {
  if (avgPaceMinPerKm) {
    return `${avgPaceMinPerKm} /km`;
  }
  if (avgPaceSecPerKm && avgPaceSecPerKm > 0) {
    const mins = Math.floor(avgPaceSecPerKm / 60);
    const secs = Math.round(avgPaceSecPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  }
  if (durationMin && durationMin > 0 && distanceKm && distanceKm > 0) {
    const totalSecPerKm = Math.round((durationMin * 60) / distanceKm);
    if (totalSecPerKm >= 60 && totalSecPerKm <= 3600) {
      const mins = Math.floor(totalSecPerKm / 60);
      const secs = totalSecPerKm % 60;
      return `${mins}:${secs.toString().padStart(2, '0')} /km`;
    }
  }
  return '-';
}
