export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Keeps the first value of each query parameter, dropping empty ones. */
export function firstValues(params: RawSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") out[key] = v;
  }
  return out;
}
