import { Time, TimeEasingCurves } from '@/constants/theme';
import { createButtonTransitionStyle } from '../buttonShared';

describe('buttonShared transitions', () => {
  it('uses short-duration easing for button hover fades', () => {
    expect(createButtonTransitionStyle('background-color, border-color')).toEqual({
      transitionProperty: 'background-color, border-color',
      transitionDuration: `${Time.duration.short}ms`,
      transitionTimingFunction: `cubic-bezier(${TimeEasingCurves['in-and-out'].join(', ')})`,
    });
  });
});