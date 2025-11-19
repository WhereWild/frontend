import React from 'react';
import { Image, Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ButtonDanger, __BUTTON_DANGER_TESTING__ } from '../ButtonDanger';
import type { ButtonDangerVariant, ButtonDangerSize } from '../ButtonDanger';
import { Colors } from '@/constants/theme';

const createIconProbe = () => {
  const calls: { color?: string }[] = [];
  const IconProbe = (props: { color?: string }) => {
    calls.push(props);
    return <Text testID="danger-icon-probe" />;
  };
  return { IconProbe, calls };
};

describe('ButtonDanger Component', () => {
  describe('Rendering', () => {
    it('renders with text children', () => {
      render(<ButtonDanger>Delete</ButtonDanger>);
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('renders with label prop', () => {
      render(<ButtonDanger label="Remove" />);
      expect(screen.getByText('Remove')).toBeDefined();
    });

    it('prioritizes label over children prop', () => {
      render(<ButtonDanger label="Label">Children</ButtonDanger>);
      expect(screen.getByText('Label')).toBeDefined();
      expect(screen.queryByText('Children')).toBeNull();
    });
  });

  describe('Variants', () => {
    const variants: ButtonDangerVariant[] = ['primary', 'subtle'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        render(<ButtonDanger variant={variant}>{variant}</ButtonDanger>);
        expect(screen.getByText(variant)).toBeDefined();
      });
    });

    it('defaults to primary variant (uses danger colors)', () => {
      const { getByRole } = render(<ButtonDanger>Delete</ButtonDanger>);
      const button = getByRole('button');
      expect(button).toBeDefined();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Sizes', () => {
    const sizes: ButtonDangerSize[] = ['small', 'medium'];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        render(<ButtonDanger size={size}>{size}</ButtonDanger>);
        expect(screen.getByText(size)).toBeDefined();
      });
    });

    it('defaults to medium size (12px padding)', () => {
      const { getByRole } = render(<ButtonDanger>Default Size</ButtonDanger>);
      const button = getByRole('button');
      const styles = button.props.style;
      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            paddingHorizontal: 12,
            paddingVertical: 12,
          }),
        ])
      );
    });
  });

  describe('Icons', () => {
    const iconSource = require('../../assets/images/react-logo.png');

    it('renders asset iconStart when provided', () => {
      render(
        <ButtonDanger
          label="Delete"
          iconStart={<Image source={iconSource} testID="danger-icon-start" />}
        />
      );

      expect(screen.getByTestId('danger-icon-start')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('renders asset iconEnd when provided', () => {
      render(
        <ButtonDanger
          label="Archive"
          iconEnd={<Image source={iconSource} testID="danger-icon-end" />}
        />
      );

      expect(screen.getByTestId('danger-icon-end')).toBeDefined();
      expect(screen.getByText('Archive')).toBeDefined();
    });

    it('hides icons during loading state', () => {
      render(
        <ButtonDanger
          loading
          label="Deleting"
          iconStart={<Image source={iconSource} testID="danger-icon-start" />}
          iconEnd={<Image source={iconSource} testID="danger-icon-end" />}
        />
      );

      expect(screen.queryByTestId('danger-icon-start')).toBeNull();
      expect(screen.queryByTestId('danger-icon-end')).toBeNull();
      expect(screen.getByText('…')).toBeDefined();
    });

    it('injects semantic icon color for primary danger variant when needed', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <ButtonDanger variant="primary" iconStart={<IconProbe />}>
          Icon
        </ButtonDanger>
      );

      expect(calls.at(-1)?.color).toBe(Colors.light.icon.danger.onDanger);
    });

    it('respects supplied icon color for danger buttons', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <ButtonDanger iconEnd={<IconProbe color="#ff00ff" />}>
          Icon
        </ButtonDanger>
      );

      expect(calls.at(-1)?.color).toBe('#ff00ff');
    });
  });

  describe('Interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<ButtonDanger onPress={onPress}>Delete Item</ButtonDanger>);

      fireEvent.press(screen.getByText('Delete Item'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <ButtonDanger disabled onPress={onPress}>
          Disabled Delete
        </ButtonDanger>
      );

      fireEvent.press(screen.getByText('Disabled Delete'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('shows loading state with ellipsis', () => {
      render(<ButtonDanger loading>Delete</ButtonDanger>);
      expect(screen.getByText('…')).toBeDefined();
    });

    it('is disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      render(
        <ButtonDanger disabled onPress={onPress}>
          Cannot Delete
        </ButtonDanger>
      );

      fireEvent.press(screen.getByText('Cannot Delete'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('is disabled when loading', () => {
      const onPress = jest.fn();
      render(
        <ButtonDanger loading onPress={onPress}>
          Delete
        </ButtonDanger>
      );

      const button = screen.getByText('…');
      fireEvent.press(button);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('uses accessibilityLabel when provided', () => {
      const { getByLabelText } = render(
        <ButtonDanger accessibilityLabel="Delete Account">
          Delete
        </ButtonDanger>
      );
      expect(getByLabelText('Delete Account')).toBeDefined();
    });

    it('sets accessibilityRole to button', () => {
      const { getByRole } = render(<ButtonDanger>Delete</ButtonDanger>);
      expect(getByRole('button')).toBeDefined();
    });

    it('indicates disabled state in accessibility', () => {
      const { getByRole } = render(
        <ButtonDanger disabled>Disabled</ButtonDanger>
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Styling', () => {
    it('applies custom style prop', () => {
      const customStyle = { marginTop: 20 };
      const { getByRole } = render(
        <ButtonDanger style={customStyle}>Styled</ButtonDanger>
      );
      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('applies custom textStyle prop', () => {
      const customTextStyle = { fontSize: 20 };
      const { getByText } = render(
        <ButtonDanger textStyle={customTextStyle}>Custom Text</ButtonDanger>
      );
      expect(getByText('Custom Text').props.style).toMatchObject(
        expect.arrayContaining([expect.objectContaining(customTextStyle)])
      );
    });

    it('uses pressed danger background token', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('primary', 'light', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.danger.pressed);
    });

    it('uses hover colors for subtle danger variant', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('subtle', 'light', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.danger.secondaryHover);
      expect(computed.iconColor).toBe(Colors.light.icon.danger.onDangerSecondary);
    });
  });

  describe('Snapshot', () => {
    it('matches snapshot (smoke test)', () => {
      const tree = render(
        <ButtonDanger variant="primary" size="medium">
          Delete Account
        </ButtonDanger>
      ).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
});
