import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import Settings from '../settings';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }),
}));

const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => false);
let mockPathname: '/' | '/about' | '/settings' = '/settings';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    canGoBack: mockCanGoBack,
  }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('Settings screen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/settings';
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders localization, measurement, and notification sections', () => {
    render(<Settings />);

    expect(screen.getByText('User Settings')).toBeTruthy();
    expect(screen.getByText('Localization')).toBeTruthy();
    expect(screen.getByText('Measurement Units')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('State')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Length Units')).toBeTruthy();
    expect(screen.getByText('Rainfall Units')).toBeTruthy();
    expect(screen.getByText('Temperature Units')).toBeTruthy();

    const stateField = screen.getByLabelText(/State:/);
    const languageField = screen.getByLabelText(/Language:/);
    const emailSwitch = screen.getByLabelText('Email');
    const pushSwitch = screen.getByLabelText('Push Notification');
    const demoSwitch = screen.getByLabelText('Demo Switch');

    expect(stateField.props.accessibilityState?.disabled).toBe(true);
    expect(languageField.props.accessibilityState?.disabled).toBe(true);
    expect(emailSwitch.props.accessibilityState?.disabled).toBe(true);
    expect(pushSwitch.props.accessibilityState?.disabled).toBe(true);
    expect(demoSwitch.props.accessibilityState?.disabled).toBe(false);
  });

  it('updates unit selects and restores defaults', async () => {
    render(<Settings />);

    const selectOption = async (labelPattern: RegExp, optionTestId: string) => {
      fireEvent.press(screen.getByLabelText(labelPattern));
      const option = await screen.findByTestId(optionTestId);
      fireEvent.press(option);
    };

    await selectOption(/Length Units/, 'select-field-option-1');
    await selectOption(/Rainfall Units/, 'select-field-option-1');
    await selectOption(/Temperature Units/, 'select-field-option-1');

    expect(screen.getByText('US imperial (miles, feet)')).toBeTruthy();
    expect(screen.getByText('US imperial (inches)')).toBeTruthy();
    expect(screen.getByText('Fahrenheit (°F)')).toBeTruthy();

    const demoSwitch = screen.getByLabelText('Demo Switch');
    fireEvent.press(demoSwitch);
    expect(screen.getByLabelText('Demo Switch').props.accessibilityState?.checked).toBe(true);

    fireEvent.press(screen.getByLabelText('Restore default settings'));

    expect(screen.getByText('Metric (kilometers, meters)')).toBeTruthy();
    expect(screen.getByText('Metric (millimeters)')).toBeTruthy();
    expect(screen.getByText('Celsius (°C)')).toBeTruthy();
    expect(screen.getByLabelText('Demo Switch').props.accessibilityState?.checked).toBe(false);
  });

  it('applies light mode palette when color scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');
    const tree = render(<Settings />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected Settings to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });
});
