const LUANDA_TIME_ZONE = "Africa/Luanda";

function formatParts(value: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: LUANDA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
}

/** Format an ISO instant for a datetime-local input in Luanda wall time. */
export function luandaDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = formatParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Convert a datetime-local value interpreted as Luanda time into an ISO instant. */
export function luandaDateTimeToIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const desired = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatParts(new Date(instant));
    const represented = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
    );
    const correction = desired - represented;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant).toISOString();
}

/** Store a date-only deadline at noon in Luanda to avoid date-boundary shifts. */
export function luandaDateToIso(value: string) {
  return luandaDateTimeToIso(`${value}T12:00`);
}

export function luandaDateInput(value: string | null) {
  return value ? luandaDateTimeInput(value).slice(0, 10) : "";
}

export function luandaTodayDateInput() {
  return luandaDateInput(new Date().toISOString());
}
