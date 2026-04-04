export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeWord = (value: string) => value.trim().toLowerCase();

export const normalizeWordList = (values: string[]) =>
  values.map(normalizeWord).filter(Boolean);

export const getPositiveInteger = (
  value: unknown,
  fallback: number,
  minimum = 1
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(parsed));
};
