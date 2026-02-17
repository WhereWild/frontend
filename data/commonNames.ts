export const dedupeCaseInsensitive = (names: string[]): string[] => {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const normalizeCommonNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name.length > 0);

  return dedupeCaseInsensitive(normalized);
};

export const buildCommonNamesWithPrimary = (
  primaryName: string,
  commonNames: unknown,
): string[] => {
  const normalizedPrimary = primaryName.trim();
  const normalizedAlternates = normalizeCommonNames(commonNames);
  const seed = normalizedPrimary.length > 0 ? normalizedPrimary : normalizedAlternates[0] ?? '';

  const merged = [seed, ...normalizedAlternates].filter((name) => name.length > 0);

  return dedupeCaseInsensitive(merged);
};
