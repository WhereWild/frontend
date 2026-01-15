import type { IconSize } from '@/primitives';

const allowedIconSizes: IconSize[] = ['14', '16', '20', '24', '32', '40', '48'];

/**
 * Snaps an arbitrary pixel value to the nearest allowed icon token size.
 *
 * This utility ensures that icon sizes remain consistent with the design system's token grid.
 * Use this function when you have a dynamic or custom icon size and want to align it to the
 * closest supported icon size token (e.g., for responsive layouts or user-supplied sizes).
 *
 * @param basePx - The desired icon size in pixels.
 * @returns The nearest allowed IconSize token as a string.
 *
 * @example
 *   snapIconSize(18); // returns '16'
 *   snapIconSize(22); // returns '20'
 *
 * Note: This function is currently unused but may be used in the future for icon sizing adjustments.
 */
export const snapIconSize = (basePx: number): IconSize =>
  allowedIconSizes.reduce<IconSize>((closest, candidate) => {
    const candidateNum = Number(candidate);
    const closestNum = Number(closest);
    return Math.abs(candidateNum - basePx) < Math.abs(closestNum - basePx) ? candidate : closest;
  }, allowedIconSizes[0]);
