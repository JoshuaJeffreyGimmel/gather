/** Swiss-German date, time and money formatting. */

const TIME = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat('de-CH', { weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long' });
const MONTH_YEAR = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days between today and `iso` — 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(iso: string): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86400000);
}

export const time = (iso: string) => TIME.format(new Date(iso));

/** "Heute", "Morgen", "Gestern", otherwise the weekday. */
export function dayName(iso: string): string {
  const d = dayOffset(iso);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d === 2) return 'Übermorgen';
  return WEEKDAY.format(new Date(iso));
}

/** "Heute 18:30" */
export const dayAndTime = (iso: string) => `${dayName(iso)} ${time(iso)}`;

/** "Heute, 18:30 – 20:00" */
export function span(startIso: string, endIso: string | null): string {
  const start = `${dayName(startIso)}, ${time(startIso)}`;
  return endIso ? `${start} – ${time(endIso)}` : start;
}

/** "18:30 – 20:00" */
export const timeSpan = (startIso: string, endIso: string | null) =>
  endIso ? `${time(startIso)} – ${time(endIso)}` : time(startIso);

/** "Mittwoch, 23. September" — the lock-screen date. */
export const longDate = (iso: string) =>
  `${WEEKDAY.format(new Date(iso))}, ${DAY_MONTH.format(new Date(iso))}`;

/** "dabei seit März 2026" */
export const monthYear = (iso: string) => MONTH_YEAR.format(new Date(iso));

/** The day number for the date tile on a list card. */
export const dayNumber = (iso: string) => String(new Date(iso).getDate());

/** "CHF 5.00" */
export const chf = (amount: number) =>
  'CHF ' + amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "in 2 Std 14 Min", "in 3 Tagen", "läuft gerade", "vorbei". */
export function countdown(startIso: string, endIso: string | null): string {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : start + 90 * 60000;
  if (now >= end) return 'vorbei';
  if (now >= start) return 'läuft gerade';

  const mins = Math.floor((start - now) / 60000);
  if (mins < 1) return 'jetzt gleich';
  if (mins < 60) return `in ${mins} Min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `in ${hours} Std ${rest} Min` : `in ${hours} Std`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'in 1 Tag' : `in ${days} Tagen`;
}

/** "jetzt", "vor 12 Min", "16:22", "Gestern" — for chat and notifications. */
export function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `vor ${mins} Min`;
  if (dayOffset(iso) === 0) return time(iso);
  if (dayOffset(iso) === -1) return 'Gestern';
  return `${new Date(iso).getDate()}.${new Date(iso).getMonth() + 1}.`;
}

/** "vor 4 Tagen" / "heute" — profile history rows. */
export function relativeDay(iso: string): string {
  const d = dayOffset(iso);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'gestern';
  if (d > 0) return `in ${d} Tagen`;
  const days = -d;
  if (days < 7) return `vor ${days} Tagen`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? 'vor 1 Woche' : `vor ${weeks} Wochen`;
}

/** "+41 79 000 00 00" */
export function prettyPhone(phone: string): string {
  const m = /^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** First letter, for an avatar without a photo. */
export const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();
