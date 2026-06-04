/**
 * Slot grid from a static config (no schedule table).
 * Mon-Fri, 9:00-17:00, every 30 min, Europe/Warsaw timezone.
 * Warsaw wall-clock is translated DETERMINISTICALLY into a UTC instant
 * (timestamptz). Availability = grid - active bookings (computed in the page).
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export const CLINIC_TZ = "Europe/Warsaw";
export const WORK_START_HOUR = 9; // first slot 09:00
export const WORK_END_HOUR = 17; // last slot starts 16:30 (ends 17:00)
export const SLOT_MINUTES = 30;
export const WORKING_DAYS_AHEAD = 5; // how many working days to show

export type Slot = {
  /** UTC instant as ISO — the slot key, matches bookings.start_time. */
  startTime: string;
  /** Hour label in the clinic timezone, e.g. "09:30". */
  time: string;
};

export type DaySlots = {
  /** Day key YYYY-MM-DD (Warsaw wall date). */
  dateKey: string;
  /** Day label, e.g. "Mon 09.06". */
  label: string;
  slots: Slot[];
};

const WEEKDAYS: Record<Locale, string[]> = {
  pl: ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const TIME_LOCALE: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Timezone offset (ms) at a given instant: (wall-clock-as-UTC) - instant.
 * Format the instant in the timezone, treat the result as UTC, subtract.
 */
function tzOffsetMs(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
  }
  // Intl may return hour=24 at midnight — normalize.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUTC - instant.getTime();
}

/**
 * Warsaw wall-clock -> UTC instant. One offset-correction iteration is enough
 * away from DST boundary seconds (working hours never hit them).
 */
function warsawWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = tzOffsetMs(CLINIC_TZ, new Date(guess));
  return new Date(guess - offset);
}

/** Wall date {y,m,d} in the clinic timezone for a given instant. */
function warsawDateParts(instant: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant); // "YYYY-MM-DD"
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

/**
 * Generates the grid starting "now". Skips weekends and past slots.
 * Note: the set of slot startTimes is locale-independent — only labels differ.
 * @param locale used for day labels.
 * @param now injectable for tests; defaults to the current instant.
 */
export function generateGrid(
  locale: Locale = DEFAULT_LOCALE,
  now: Date = new Date()
): DaySlots[] {
  const nowMs = now.getTime();
  const days: DaySlots[] = [];

  let cursor = warsawDateParts(now);
  let guard = 0;

  while (days.length < WORKING_DAYS_AHEAD && guard < 31) {
    guard++;
    // Weekday of a calendar date is timezone-independent.
    const dow = new Date(Date.UTC(cursor.y, cursor.m - 1, cursor.d)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    if (!isWeekend) {
      const slots: Slot[] = [];
      for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
        for (let min = 0; min < 60; min += SLOT_MINUTES) {
          const startUtc = warsawWallToUtc(cursor.y, cursor.m, cursor.d, h, min);
          if (startUtc.getTime() <= nowMs) continue; // future slots only
          slots.push({ startTime: startUtc.toISOString(), time: `${pad(h)}:${pad(min)}` });
        }
      }
      if (slots.length > 0) {
        days.push({
          dateKey: `${cursor.y}-${pad(cursor.m)}-${pad(cursor.d)}`,
          label: `${WEEKDAYS[locale][dow]} ${pad(cursor.d)}.${pad(cursor.m)}`,
          slots,
        });
      }
    }

    // Next calendar day.
    const next = new Date(Date.UTC(cursor.y, cursor.m - 1, cursor.d) + 86_400_000);
    cursor = { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
  }

  return days;
}

/** Readable instant label in the clinic timezone, e.g. "Mon 09.06, 09:30". */
export function formatSlotLabel(isoUtc: string, locale: Locale = DEFAULT_LOCALE): string {
  const d = new Date(isoUtc);
  const { y, m, d: day } = warsawDateParts(d);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const time = new Intl.DateTimeFormat(TIME_LOCALE[locale], {
    timeZone: CLINIC_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${WEEKDAYS[locale][dow]} ${pad(day)}.${pad(m)}, ${time}`;
}
