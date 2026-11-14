export function formatKwanza(value: number, locale = 'pt-AO'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'AOA',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatLuandaDate(value: Date | string, locale = 'pt-AO'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'Africa/Luanda',
  }).format(typeof value === 'string' ? new Date(value) : value);
}
