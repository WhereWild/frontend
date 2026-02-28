import {
  getMeasuredWidthOrFallback,
  hasAllTabMeasurements,
  updateMeasuredTabWidths,
} from '../navigationBarMeasurement';

describe('navigationBarMeasurement', () => {
  it('detects whether all tab widths have been measured', () => {
    expect(hasAllTabMeasurements(['a', 'b'], { a: 100 })).toBe(false);
    expect(hasAllTabMeasurements(['a', 'b'], { a: 100, b: 120 })).toBe(true);
  });

  it('updates tab widths only when needed', () => {
    const previous = { a: 100 };

    const updated = updateMeasuredTabWidths(previous, ['a', 'b'], 'b', 120);
    expect(updated).toEqual({ a: 100, b: 120 });

    const unchangedSameValue = updateMeasuredTabWidths(updated, ['a', 'b'], 'b', 120);
    expect(unchangedSameValue).toBe(updated);

    const unchangedAllMeasured = updateMeasuredTabWidths(updated, ['a', 'b'], 'a', 110);
    expect(unchangedAllMeasured).toBe(updated);
  });

  it('falls back to horizontal minimum width when tab is not measured', () => {
    expect(getMeasuredWidthOrFallback({ a: 140 }, 'a')).toBe(140);
    expect(getMeasuredWidthOrFallback({ a: 140 }, 'b')).toBe(96);
  });
});
