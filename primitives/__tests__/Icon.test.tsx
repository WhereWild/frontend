import { Colors } from '@/constants/theme';
import React from 'react';
import { withPlatformOS } from '../../test-utils/withPlatformOS';
import { __ICON_TESTING__, Icon } from '../Icon';

describe('Icon', () => {
  it('uses currentColor for generated stroke tokens on web', () => {
    withPlatformOS('web', () => {
      const node = __ICON_TESTING__.normalizeNode(
        React.createElement('path', { stroke: 'var(--svg-stroke-color)' }),
        { stroke: '#123456', fill: 'none' },
        { useStyleDrivenStroke: true },
      ) as React.ReactElement<{ stroke?: string }>;

      expect(node.props.stroke).toBe('currentColor');
    });
  });

  it('keeps explicit stroke colors on native platforms', () => {
    withPlatformOS('ios', () => {
      const node = __ICON_TESTING__.normalizeNode(
        React.createElement('path', { stroke: 'var(--svg-stroke-color)' }),
        { stroke: '#123456', fill: 'none' },
        { useStyleDrivenStroke: false },
      ) as React.ReactElement<{ stroke?: string }>;

      expect(node.props.stroke).toBe('#123456');
    });
  });

  it('applies the resolved stroke color to web svg style', () => {
    withPlatformOS('web', () => {
      const rendered = Icon({
        color: '#abcdef',
        children: React.createElement('path', { stroke: 'var(--svg-stroke-color)' }),
      });

      expect(rendered.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#abcdef' })]),
      );
    });
  });

  it('falls back to the semantic icon color when no override is provided', () => {
    withPlatformOS('web', () => {
      const rendered = Icon({
        children: React.createElement('path', { stroke: 'var(--svg-stroke-color)' }),
      });

      expect(rendered.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: Colors.dark.icon.default.default })]),
      );
    });
  });
});