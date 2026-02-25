const HORIZONTAL_MIN_TAB_WIDTH = 96;

export const hasAllTabMeasurements = (
  tabKeys: string[],
  measuredTabWidths: Record<string, number>,
) => tabKeys.every((key) => measuredTabWidths[key] !== undefined);

export const updateMeasuredTabWidths = (
  previousWidths: Record<string, number>,
  tabKeys: string[],
  tabKey: string,
  width: number,
) => {
  if (hasAllTabMeasurements(tabKeys, previousWidths)) {
    return previousWidths;
  }

  if (previousWidths[tabKey] === width) {
    return previousWidths;
  }

  return {
    ...previousWidths,
    [tabKey]: width,
  };
};

export const getMeasuredWidthOrFallback = (
  measuredTabWidths: Record<string, number>,
  tabKey: string,
) => measuredTabWidths[tabKey] ?? HORIZONTAL_MIN_TAB_WIDTH;
