import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { RadioField } from '../RadioField';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const getStyleProperty = (styles: unknown[], propertyName: string): string | undefined => {
  for (let index = styles.length - 1; index >= 0; index -= 1) {
    const style = styles[index];
    if (typeof style === 'object' && style !== null && propertyName in style) {
      const value = (style as Record<string, unknown>)[propertyName];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  return undefined;
};

describe('RadioField', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('dark');
  });

  it('uses fallback accessibility label when no label is provided', () => {
    render(<RadioField checked={false} />);

    expect(screen.getByLabelText('Radio field')).toBeTruthy();
    expect(screen.queryByText('Label')).toBeNull();
  });

  it('uses explicit accessibilityLabel when provided', () => {
    render(<RadioField label="Label" accessibilityLabel="Custom radio" checked={false} />);

    expect(screen.getByLabelText('Custom radio')).toBeTruthy();
  });

  it('renders label and description when provided', () => {
    render(<RadioField label="Label" description="Description" checked />);

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('selects to true when pressed from unchecked controlled state', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label="Radio"
        checked={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Radio'));
    expect(handleValueChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when pressing the label text', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label="Radio"
        checked={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByText('Radio'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('does not emit when already checked', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label="Radio"
        checked
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Radio'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('does not emit when disabled', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label="Disabled radio"
        checked={false}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const control = screen.getByLabelText('Disabled radio');
    fireEvent.press(control);

    expect(control.props.accessibilityState.disabled).toBe(true);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('manages checked state internally when uncontrolled', () => {
    render(<RadioField label="Uncontrolled radio" defaultChecked={false} />);

    const control = screen.getByLabelText('Uncontrolled radio');
    expect(control.props.accessibilityState.selected).toBe(false);

    fireEvent.press(control);

    expect(screen.getByLabelText('Uncontrolled radio').props.accessibilityState.selected).toBe(true);
  });

  it('applies selected and unselected indicator border colors', () => {
    const palette = Colors.dark;
    let selectedRenderer: renderer.ReactTestRenderer;
    let unselectedRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      selectedRenderer = renderer.create(<RadioField label="Selected" checked />);
      unselectedRenderer = renderer.create(<RadioField label="Unselected" checked={false} />);
    });

    const selectedNode = selectedRenderer!.root.findByProps({ accessibilityLabel: 'Selected' });
    const selectedChild = selectedNode.props.children({ pressed: false, hovered: false });
    const selectedStyle = selectedChild.props.style as unknown[];

    const unselectedNode = unselectedRenderer!.root.findByProps({ accessibilityLabel: 'Unselected' });
    const unselectedChild = unselectedNode.props.children({ pressed: false, hovered: false });
    const unselectedStyle = unselectedChild.props.style as unknown[];

    expect(getStyleProperty(selectedStyle, 'borderColor')).toBe(palette.background.brand.default);
    expect(getStyleProperty(unselectedStyle, 'borderColor')).toBe(palette.border.default.default);
  });

  it('applies hover and pressed styles for checked indicator', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(<RadioField label="Checked state" checked />);
    });

    const radioNode = testRenderer!.root.findByProps({ accessibilityLabel: 'Checked state' });
    const hoveredChild = radioNode.props.children({ pressed: false, hovered: true });
    const hoveredStyle = hoveredChild.props.style as unknown[];

    const pressedChild = radioNode.props.children({ pressed: true, hovered: false });
    const pressedStyle = pressedChild.props.style as unknown[];

    expect(getStyleProperty(hoveredStyle, 'backgroundColor')).toBe(palette.background.brand.hover);
    expect(getStyleProperty(pressedStyle, 'backgroundColor')).toBe(palette.background.brand.default);
  });

  it('applies hover and pressed styles for unchecked indicator', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(<RadioField label="Unchecked state" checked={false} />);
    });

    const radioNode = testRenderer!.root.findByProps({ accessibilityLabel: 'Unchecked state' });
    const hoveredChild = radioNode.props.children({ pressed: false, hovered: true });
    const hoveredStyle = hoveredChild.props.style as unknown[];

    const pressedChild = radioNode.props.children({ pressed: true, hovered: false });
    const pressedStyle = pressedChild.props.style as unknown[];

    expect(getStyleProperty(hoveredStyle, 'backgroundColor')).toBe(palette.background.default.hover);
    expect(getStyleProperty(pressedStyle, 'backgroundColor')).toBe(palette.background.default.pressed);
  });

  it('exposes radio accessibility role and selected state', () => {
    render(<RadioField label="A11y radio" checked />);

    const radio = screen.getByLabelText('A11y radio');
    expect(radio.props.accessibilityRole).toBe('radio');
    expect(radio.props.accessibilityState.selected).toBe(true);
  });

  it('uses light palette tokens when color scheme is light', () => {
    mockedUseColorScheme.mockReturnValue('light');
    const palette = Colors.light;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(<RadioField label="Light mode" checked={false} />);
    });

    const radioNode = testRenderer!.root.findByProps({ accessibilityLabel: 'Light mode' });
    const defaultChild = radioNode.props.children({ pressed: false, hovered: false });
    const defaultStyle = defaultChild.props.style as unknown[];

    expect(getStyleProperty(defaultStyle, 'backgroundColor')).toBe(palette.background.default.default);
    expect(getStyleProperty(defaultStyle, 'borderColor')).toBe(palette.border.default.default);
  });
});
