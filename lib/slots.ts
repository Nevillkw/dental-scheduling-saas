/**
 * Grid slotow ze STALEJ konfiguracyjnej (brak tabeli grafikow).
 * Pon-Pt, 9:00-17:00, co 30 min, strefa Europe/Warsaw.
 * Wall-clock w Warszawie tlumaczony DETERMINISTYCZNIE na instant UTC (timestamptz).
 * Dostepnosc = grid - aktywne bookingi (liczona w warstwie strony).
 */

export const CLINIC_TZ = "Europe/Warsaw";
export const WORK_START_HOUR = 9; // pierwszy slot 09:00
export const WORK_END_HOUR = 17; // ostatni slot startuje 16:30 (konczy 17:00)
export const SLOT_MINUTES = 30;
export const WORKING_DAYS_AHEAD = 5; // ile dni roboczych pokazujemy

export type Slot = {
  /** Instant UTC w ISO — klucz slotu, zgodny z bookings.start_time. */
  startTime: string;
  /** Etykieta godziny w strefie kliniki, np. "09:30". */
  time: string;
};

export type DaySlots = {
  /** Klucz dnia YYYY-MM-DD (data scianna w Warszawie). */
  dateKey: string;
  /** Etykieta dnia, np. "Pon 09.06". */
  label: string;
  slots: Slot[];
};

const WEEKDAY_PL = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Offset strefy (ms) w danym instancie: (wall-clock-jako-UTC) - instant.
 * Algorytm: sformatuj instant w strefie, potraktuj wynik jak UTC, odejmij.
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
  // Intl potrafi zwrocic hour=24 o polnocy — normalizujemy.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUTC - instant.getTime();
}

/**
 * Wall-clock w Warszawie -> instant UTC. Jedna iteracja korekty offsetu
 * wystarcza poza sekundami granic DST (godziny pracy ich nie dotykaja).
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

/** Data scianna {y,m,d} w strefie kliniki dla danego instantu. */
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
 * Generuje grid od "teraz". Pomija weekendy, pomija sloty z przeszlosci.
 * @param now wstrzykiwalne dla testow; domyslnie biezacy instant.
 */
export function generateGrid(now: Date = new Date()): DaySlots[] {
  const nowMs = now.getTime();
  const days: DaySlots[] = [];

  let cursor = warsawDateParts(now);
  let guard = 0;

  while (days.length < WORKING_DAYS_AHEAD && guard < 31) {
    guard++;
    // Dzien tygodnia daty kalendarzowej jest niezalezny od strefy.
    const dow = new Date(Date.UTC(cursor.y, cursor.m - 1, cursor.d)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    if (!isWeekend) {
      const slots: Slot[] = [];
      for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
        for (let min = 0; min < 60; min += SLOT_MINUTES) {
          const startUtc = warsawWallToUtc(cursor.y, cursor.m, cursor.d, h, min);
          if (startUtc.getTime() <= nowMs) continue; // tylko przyszle sloty
          slots.push({ startTime: startUtc.toISOString(), time: `${pad(h)}:${pad(min)}` });
        }
      }
      if (slots.length > 0) {
        days.push({
          dateKey: `${cursor.y}-${pad(cursor.m)}-${pad(cursor.d)}`,
          label: `${WEEKDAY_PL[dow]} ${pad(cursor.d)}.${pad(cursor.m)}`,
          slots,
        });
      }
    }

    // Nastepny dzien kalendarzowy.
    const next = new Date(Date.UTC(cursor.y, cursor.m - 1, cursor.d) + 86_400_000);
    cursor = { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
  }

  return days;
}

/** Czytelna etykieta instantu w strefie kliniki, np. "Pon 09.06, 09:30". */
export function formatSlotLabel(isoUtc: string): string {
  const d = new Date(isoUtc);
  const { y, m, d: day } = warsawDateParts(d);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: CLINIC_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${WEEKDAY_PL[dow]} ${pad(day)}.${pad(m)}, ${time}`;
}
