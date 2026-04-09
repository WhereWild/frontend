type LayoutTabItem = {
  key: string;
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
};

export type TabLayout = {
  tabWidths: Record<string, number>;
  shouldScroll: boolean;
};

export type ComputeTabLayoutArgs = {
  tabs: LayoutTabItem[];
  containerWidth: number;
  labelWidths: Record<string, number>;
  horizontalPadding: number;
  minimumTabWidth?: number;
  nonScrollFitBufferPx?: number;
};

// Computes tab widths and whether horizontal scrolling is required.
//
// Rules:
// 1) If all labels fit in equal-width tabs, use equal widths.
// 2) If some labels exceed equal width, shrink only shorter tabs first
//    by distributing deficit across available slack.
// 3) If slack cannot cover deficit, enable scrolling.
export const computeTabLayout = ({
  tabs,
  containerWidth,
  labelWidths,
  horizontalPadding,
  minimumTabWidth = 0,
  nonScrollFitBufferPx = 0,
}: ComputeTabLayoutArgs): TabLayout => {
  if (containerWidth <= 0 || tabs.length === 0) {
    return { tabWidths: {}, shouldScroll: false };
  }

  const equalWidth = containerWidth / tabs.length;
  const minTabWidth = Math.max(0, minimumTabWidth);
  const contentRequiredWidths = tabs.map((tab) => {
    const labelWidth = labelWidths[tab.key] ?? 0;
    return Math.max(labelWidth + horizontalPadding, minTabWidth);
  });

  const canUseEqualWidths = contentRequiredWidths.every(
    (width) => width + nonScrollFitBufferPx <= equalWidth,
  );
  if (canUseEqualWidths) {
    const totalRequiredWidth = contentRequiredWidths.reduce(
      (sum, width) => sum + width,
      0,
    );
    const remainingWidth = Math.max(0, containerWidth - totalRequiredWidth);
    const extraPerTab = tabs.length > 0 ? remainingWidth / tabs.length : 0;

    return {
      tabWidths: tabs.reduce<Record<string, number>>((acc, tab, index) => {
        acc[tab.key] = Math.max(0, contentRequiredWidths[index] + extraPerTab);
        return acc;
      }, {}),
      shouldScroll: false,
    };
  }

  const deficits = contentRequiredWidths.map((width) =>
    Math.max(0, width - equalWidth),
  );
  const totalDeficit = deficits.reduce((sum, value) => sum + value, 0);
  const slacks = contentRequiredWidths.map((width) =>
    Math.max(0, equalWidth - width),
  );
  const totalSlack = slacks.reduce((sum, value) => sum + value, 0);
  const shouldScroll = totalDeficit > totalSlack;
  const widthWithScrollFloor = (width: number) =>
    shouldScroll ? Math.max(width, minTabWidth) : width;

  const desiredWidths = contentRequiredWidths.map((width, index) => {
    if (width >= equalWidth) {
      return widthWithScrollFloor(width);
    }

    if (shouldScroll || totalSlack === 0) {
      return widthWithScrollFloor(width);
    }

    const slackShare = slacks[index] / totalSlack;
    const shrinkAmount = totalDeficit * slackShare;
    return Math.max(width, equalWidth - shrinkAmount);
  });

  return {
    tabWidths: tabs.reduce<Record<string, number>>((acc, tab, index) => {
      acc[tab.key] = Math.max(0, desiredWidths[index]);
      return acc;
    }, {}),
    shouldScroll,
  };
};
