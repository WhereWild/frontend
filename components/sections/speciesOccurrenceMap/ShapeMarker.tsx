// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Svg, { Circle, Rect, Polygon, Path } from 'react-native-svg';
import type { ShapeKey } from './cbColors';

const OUTLINE_STROKE = 'rgba(176,176,176,0.65)';
const OUTLINE_WIDTH = 2.5;

function shapeContent(shape: ShapeKey, color: string, outline: boolean) {
  const s = outline
    ? { stroke: OUTLINE_STROKE, strokeWidth: OUTLINE_WIDTH }
    : {};
  switch (shape) {
    case 'circle':
      return <Circle cx={4} cy={4} r={3.8} fill={color} {...s} />;
    case 'square':
      return <Rect x={0.5} y={0.5} width={7} height={7} fill={color} {...s} />;
    case 'triangle':
      return <Polygon points='4,-0.4 8.4,8.4 -0.4,8.4' fill={color} {...s} />;
    case 'triangle-down':
      return <Polygon points='-0.4,-0.4 8.4,-0.4 4,8.4' fill={color} {...s} />;
    case 'diamond':
      return <Polygon points='4,0 8,4 4,8 0,4' fill={color} {...s} />;
    case 'ring':
      return outline ? (
        <>
          <Circle
            cx={4}
            cy={4}
            r={2.8}
            stroke={OUTLINE_STROKE}
            strokeWidth={OUTLINE_WIDTH + 1.5}
            fill='none'
          />
          <Circle
            cx={4}
            cy={4}
            r={2.8}
            stroke={color}
            strokeWidth={2.2}
            fill='none'
          />
        </>
      ) : (
        <Circle
          cx={4}
          cy={4}
          r={2.8}
          stroke={color}
          strokeWidth={2.2}
          fill='none'
        />
      );
    case 'cross':
      return (
        <Path
          d='M1.5,0 L4,2.5 L6.5,0 L8,1.5 L5.5,4 L8,6.5 L6.5,8 L4,5.5 L1.5,8 L0,6.5 L2.5,4 L0,1.5 Z'
          fill={color}
          {...s}
        />
      );
    case 'plus':
      return (
        <Path
          d='M3,0 L5,0 L5,3 L8,3 L8,5 L5,5 L5,8 L3,8 L3,5 L0,5 L0,3 L3,3 Z'
          fill={color}
          {...s}
        />
      );
    case 'star':
      return (
        <Polygon points='4,0 5,3 8,4 5,5 4,8 3,5 0,4 3,3' fill={color} {...s} />
      );
    case 'hexagon':
      return (
        <Polygon
          points='8,4 6,7.46 2,7.46 0,4 2,0.54 6,0.54'
          fill={color}
          {...s}
        />
      );
    case 'pentagon':
      return (
        <Polygon
          points='4,0 7.8,2.76 6.35,7.24 1.65,7.24 0.2,2.76'
          fill={color}
          {...s}
        />
      );
    case 'arrow':
      return (
        <Polygon
          points='0,2.5 5,2.5 5,0 8,4 5,8 5,5.5 0,5.5'
          fill={color}
          {...s}
        />
      );
  }
}

type ShapeMarkerProps = {
  shape: ShapeKey;
  color: string;
  size?: number;
  outline?: boolean;
};

export function ShapeMarker({
  shape,
  color,
  size = 8,
  outline = false,
}: ShapeMarkerProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='-0.5 -0.5 9 9'
      style={{ flexShrink: 0 }}
    >
      {shapeContent(shape, color, outline)}
    </Svg>
  );
}
