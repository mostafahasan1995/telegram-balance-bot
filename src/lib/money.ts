/**
 * Money, as strings.
 *
 * NOTHING HERE TURNS AN AMOUNT INTO A NUMBER. `Number("12345678.90")` is already wrong at the
 * scale this product runs at (balances are millions of old lira), and one rounded balance shown to
 * a player is a support ticket. Every amount arrives as a decimal string beside its integer minor
 * units; display formats the string, arithmetic uses BigInt on the minor units.
 */

/** The digits after the point in a formatted amount — the currency's scale, as the server used it. */
export function scaleOf(amount: string): number {
  const fraction = amount.split(".")[1];
  return fraction === undefined ? 0 : fraction.length;
}

/** `12345678.90` -> `12,345,678.90`, grouped for reading, never re-rounded. */
export function formatAmount(amount: string): string {
  const [whole = "0", fraction] = amount.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return fraction === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${fraction}`;
}

/** The same, with the decimals dropped — for a chip or a limit, where they only add noise. */
export function formatWhole(amount: string): string {
  return formatAmount(amount.split(".")[0] ?? "0");
}

/**
 * What the player typed, as minor units — or null when it is not a number we can send.
 *
 * Accepts Arabic-Indic digits, an Arabic decimal separator, and thousands separators, because a
 * phone keyboard in Arabic produces all three. Refuses anything else rather than guessing.
 */
export function toMinor(input: string, scale: number): string | null {
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[,\s٬]/g, "");

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > scale) return null;
  const padded = fraction.padEnd(scale, "0");
  const minor = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return minor.length === 0 ? "0" : minor;
}

/** Minor units back to a decimal string, for showing a total the server has not formatted. */
export function fromMinor(minor: string, scale: number): string {
  const negative = minor.startsWith("-");
  const digits = (negative ? minor.slice(1) : minor).padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale === 0 ? "" : `.${digits.slice(digits.length - scale)}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** a + b, on minor units. */
export function addMinor(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

/** a - b, on minor units. */
export function subMinor(a: string, b: string): string {
  return (BigInt(a) - BigInt(b)).toString();
}

export function compareMinor(a: string, b: string): number {
  const left = BigInt(a);
  const right = BigInt(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** A short, human time for a card: `14:48`. */
export function timeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const AR_MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

/** The day/month pair the operation cards show down the right-hand side. */
export function dayMonthOf(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: "—", month: "" };
  return {
    day: String(date.getDate()),
    month: AR_MONTHS[date.getMonth()] ?? "",
  };
}
