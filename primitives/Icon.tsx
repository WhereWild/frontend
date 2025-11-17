import React from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  SvgProps,
} from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type IconSize = '14' | '16' | '20' | '24' | '32' | '40' | '48';
export type IconProps = {
  children?: React.ReactNode;
  size?: IconSize;
  /**
   * Optional stroke color override; defaults to semantic icon token.
   */
  color?: string;
  /**
   * Optional fill color override for nodes that reference the design token fill variable.
   */
  fillColor?: string;
  accessibilityLabel?: string;
  testID?: string;
} & Pick<SvgProps, 'style'>;

// These placeholders are emitted by the icon generator; we swap them for runtime tokens later.
const STROKE_TOKEN = 'var(--svg-stroke-color)';
const FILL_TOKEN = 'var(--svg-fill-color)';

// Figma exports nodes as plain tag strings; map them to the matching react-native-svg components.
const ELEMENT_MAP: Record<string, React.ComponentType<any>> = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  ellipse: Ellipse,
  g: G,
  defs: Defs,
  clipPath: ClipPath,
};

type NormalizedColors = {
  stroke: string;
  fill: string;
};

// Recursively clone every SVG node so we can replace token placeholders and string-based tags.
const normalizeNode = (
  node: React.ReactNode,
  colors: NormalizedColors,
): React.ReactNode => {
  if (!React.isValidElement(node)) {
    return node;
  }

  const { children, ...rest } = (node.props ?? {}) as {
    children?: React.ReactNode;
    [key: string]: unknown;
  };
  const resolvedProps = { ...rest } as Record<string, unknown>;

  if (typeof resolvedProps.stroke === 'string' && resolvedProps.stroke.includes(STROKE_TOKEN)) {
    resolvedProps.stroke = colors.stroke;
  }

  if (typeof resolvedProps.fill === 'string' && resolvedProps.fill.includes(FILL_TOKEN)) {
    resolvedProps.fill = colors.fill;
  }

  const mappedChildren = React.Children.map(children, (child) => normalizeNode(child, colors));
  const mappedType = typeof node.type === 'string' ? ELEMENT_MAP[node.type] : node.type;

  if (!mappedType) {
    return React.cloneElement(node, resolvedProps, mappedChildren);
  }

  return React.createElement(
    mappedType,
    {
      key: node.key,
      ...resolvedProps,
    },
    mappedChildren,
  );
};

export function Icon({
  children,
  size = '16',
  color,
  fillColor,
  accessibilityLabel,
  testID,
  style,
}: IconProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const resolvedStroke = color ?? Colors[mode].icon.default.default;
  const resolvedFill = fillColor ?? 'none';

  const sizeValue = Number(size ?? 16);
  // The icon generator in /assets/icons emits DOM-like SVG. Normalize it so themes and RN primitives work.
  const content = React.Children.map(children, (child) =>
    normalizeNode(child, { stroke: resolvedStroke, fill: resolvedFill }),
  );

  return (
    <Svg
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 16 16"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style}
    >
      {content}
    </Svg>
  );
}
