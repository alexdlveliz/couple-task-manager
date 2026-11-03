import { Temporal } from '@js-temporal/polyfill';

export function currentZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
export function convertDeadline(date: string, time: string, zone: string): { instant: string; offset: string; ambiguous: boolean } {
  const plain = Temporal.PlainDateTime.from(`${date}T${time}`);
  const fields = { timeZone: zone, year: plain.year, month: plain.month, day: plain.day, hour: plain.hour, minute: plain.minute, second: plain.second };
  const earlier = Temporal.ZonedDateTime.from(fields, { disambiguation: 'earlier', overflow: 'reject' });
  const later = Temporal.ZonedDateTime.from(fields, { disambiguation: 'later', overflow: 'reject' });
  if (!earlier.toPlainDateTime().equals(plain) || !later.toPlainDateTime().equals(plain)) throw new Error('Esta hora no existe en tu zona horaria. Elige otra hora.');
  return { instant: earlier.toInstant().toString(), offset: earlier.offset, ambiguous: earlier.epochNanoseconds !== later.epochNanoseconds };
}
export function deadlineFields(instant: string, zone: string): { date: string; time: string; offset: string } {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(zone);
  return { date: value.toPlainDate().toString(), time: `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`, offset: value.offset };
}
export function displayDeadline(instant: string, zone = currentZone()): string {
  const fields = deadlineFields(instant, zone);
  const formatted = new Intl.DateTimeFormat('es', { timeZone: zone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instant));
  return `${formatted} · ${zone} (UTC${fields.offset.replace('-', '−')})`;
}
