// Money is a JSON number in pesos (NUMERIC(10,2) in the DB). Display only; never do money math with floats
// for anything that matters. The backend uses integer centavos or a decimal library.

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

/** ₱1,200.00 */
export function formatPeso(amount: number | null | undefined): string {
  return amount === null || amount === undefined || Number.isNaN(amount) ? "—" : peso.format(amount);
}

/** Round to 2 decimals (display / mock use). */
export const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;