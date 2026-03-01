const HORIZONTAL_MIN_TAB_WIDTH = 96;

/** Returns true when every tab key has a measured width entry. */
export const hasAllTabMeasurements = (
  tabKeys: string[],
  measuredTabWidths: Record<string, number>,
) => tabKeys.every((key) => measuredTabWidths[key] !== undefined);

/**
 * Updates one measured tab width while preserving structural sharing.
 * Skips writes when value is unchanged.
 */
export const updateMeasuredTabWidths = (
  previousWidths: Record<string, number>,
  tabKey: string,
  width: number,
) => {
  if (previousWidths[tabKey] === width) {
    return previousWidths;
  }

  return {
    ...previousWidths,
    [tabKey]: width,
  };
};

/** Returns a measured width, falling back to horizontal minimum when missing. */
export const getMeasuredWidthOrFallback = (
  measuredTabWidths: Record<string, number>,
  tabKey: string,
) => measuredTabWidths[tabKey] ?? HORIZONTAL_MIN_TAB_WIDTH;
