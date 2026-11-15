const kwanzaFormatter = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAOA(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? kwanzaFormatter.format(amount) : "—";
}
