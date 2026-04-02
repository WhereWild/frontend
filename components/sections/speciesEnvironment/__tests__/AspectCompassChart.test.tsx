import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { AspectCompassChart } from '../AspectCompassChart';
import type { SpeciesEnvironmentCategory } from '@/data/types';

const mockReactLocal = React;
const mockRNView = View;
const mockRNPressable = Pressable;
const mockRNText = Text;

type MockPill = { key: string; label: string };
type NavigationPillListMockProps = {
  pills: MockPill[];
  selectedKey?: string;
  onSelectionChange?: (key: string) => void;
};

jest.mock('@/components/navigation/NavigationPillList', () => ({
  NavigationPillList: (props: NavigationPillListMockProps) => {
    const { pills, onSelectionChange } = props;
    return mockReactLocal.createElement(
      mockRNView,
      null,
      pills.map((pill) =>
        mockReactLocal.createElement(
          mockRNPressable,
          {
            key: pill.key,
            testID: `pill-${pill.key}`,
            onPress: () => onSelectionChange?.(pill.key),
          },
          mockReactLocal.createElement(mockRNText, null, pill.label),
        ),
      ),
    );
  },
}));

jest.mock('react-native-svg', () => {
  const MockSvg = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, { testID: 'svg-root' }, children);

  const MockPath = ({
    onPress,
    testID,
  }: {
    onPress?: () => void;
    testID?: string;
    d?: string;
    fill?: string;
    opacity?: number;
  }) =>
    mockReactLocal.createElement(mockRNPressable, { onPress, testID }, null);

  const MockPassthrough = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, null, children);

  return {
    __esModule: true,
    default: MockSvg,
    Circle: MockPassthrough,
    Path: MockPath,
    Text: MockPassthrough,
  };
});

const makeCategory = (
  value: string | number,
  className: string,
  fraction: number,
  overrides: Partial<SpeciesEnvironmentCategory> = {},
): SpeciesEnvironmentCategory => ({
  value,
  className,
  count: Math.round(fraction * 100),
  fraction,
  ...overrides,
});

describe('AspectCompassChart', () => {
  it('renders empty state when categories array is empty', () => {
    render(
      <AspectCompassChart
        categories={[]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );
    expect(screen.getByText('Aspect data unavailable.')).toBeTruthy();
  });

  it('renders empty state when all categories have negative fractions', () => {
    render(
      <AspectCompassChart
        categories={[makeCategory('N', 'N', -0.1)]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );
    expect(screen.getByText('Aspect data unavailable.')).toBeTruthy();
  });

  it('renders the SVG compass when valid categories are provided', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory(1, 'N', 0.3),
          makeCategory(5, 'S', 0.2),
        ]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );
    expect(screen.getByTestId('svg-root')).toBeTruthy();
  });

  it('renders pills in compass direction order (N→NE→E→…→NW)', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory('W', 'W', 0.1),
          makeCategory('N', 'N', 0.3),
          makeCategory('E', 'E', 0.2),
          makeCategory('S', 'S', 0.15),
        ]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );

    const pillLabels = ['N', 'E', 'S', 'W'].map((dir) =>
      screen.getByText(dir),
    );
    expect(pillLabels).toHaveLength(4);

    // N pill should appear before E in the rendered order
    const allText = screen.getAllByText(/^(N|E|S|W)$/);
    const labels = allText.map((n) => n.props.children as string);
    expect(labels.indexOf('N')).toBeLessThan(labels.indexOf('E'));
    expect(labels.indexOf('E')).toBeLessThan(labels.indexOf('S'));
    expect(labels.indexOf('S')).toBeLessThan(labels.indexOf('W'));
  });

  it('calls onSelect with category value when a pill is pressed', () => {
    const onSelect = jest.fn();
    render(
      <AspectCompassChart
        categories={[makeCategory('N', 'N', 0.4)]}
        selectedValue={null}
        onSelect={onSelect}
        descriptionColor="#666"
      />,
    );

    fireEvent.press(screen.getByTestId('pill-N'));
    expect(onSelect).toHaveBeenCalledWith('N');
  });

  it('shows description text when a category is selected', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory('N', 'N', 0.4, { description: 'North-facing slopes.' }),
        ]}
        selectedValue="N"
        descriptionColor="#666"
      />,
    );

    expect(screen.getByText(/North-facing slopes/)).toBeTruthy();
    expect(screen.getByText(/This accounts for 40% of all observations/)).toBeTruthy();
  });

  it('shows __other__ aggregated description copy', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory('__other__', '__other__', 0.25),
        ]}
        selectedValue="__other__"
        descriptionColor="#666"
      />,
    );

    expect(screen.getByText(/Together these account/)).toBeTruthy();
  });

  it('shows no description when no category is selected', () => {
    render(
      <AspectCompassChart
        categories={[makeCategory('N', 'N', 0.5)]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );

    expect(screen.queryByText(/This accounts/)).toBeNull();
  });

  it('resolves full-name className to short direction (North → N)', () => {
    const onSelect = jest.fn();
    render(
      <AspectCompassChart
        categories={[makeCategory(1, 'North', 0.3)]}
        selectedValue={null}
        onSelect={onSelect}
        descriptionColor="#666"
      />,
    );

    expect(screen.getByText('N')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pill-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('resolves numeric value to direction (1 → N, 3 → E)', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory(1, 'Unknown', 0.3),
          makeCategory(3, 'Unknown', 0.2),
        ]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );

    expect(screen.getByText('N')).toBeTruthy();
    expect(screen.getByText('E')).toBeTruthy();
  });

  it('resolves string value matching short direction code (value = "SE")', () => {
    render(
      <AspectCompassChart
        categories={[makeCategory('SE', 'Unknown', 0.2)]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );

    expect(screen.getByText('SE')).toBeTruthy();
  });

  it('skips categories whose direction cannot be resolved', () => {
    render(
      <AspectCompassChart
        categories={[
          makeCategory('unresolvable', 'Unknown Label', 0.5),
          makeCategory('N', 'N', 0.5),
        ]}
        selectedValue={null}
        descriptionColor="#666"
      />,
    );

    // Only N should appear as a pill — unresolvable direction is not rendered
    expect(screen.getByText('N')).toBeTruthy();
    expect(screen.queryByText('Unknown Label')).toBeNull();
  });
});
