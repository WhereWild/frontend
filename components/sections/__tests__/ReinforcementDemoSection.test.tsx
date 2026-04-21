import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReinforcementDemoSection } from '../ReinforcementDemoSection';
import type { ReinforcementDemoState } from '@/hooks/species/useReinforcementDemo';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');

  return {
    ButtonDanger: ({
      children,
      disabled,
      onPress,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) => (
      <Pressable
        accessibilityRole='button'
        testID='reset-personalized-head'
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{children}</Text>
        <Text>{disabled ? 'disabled' : 'enabled'}</Text>
      </Pressable>
    ),
    RadioGroup: ({
      label,
      options,
      value,
      disabled,
      onValueChange,
    }: {
      label: string;
      options: { label: string; value: string; description?: string }[];
      value: string;
      disabled?: boolean;
      onValueChange?: (value: string) => void;
    }) => (
      <View>
        <Text>{label}</Text>
        <Text>{`Selected mode: ${value}`}</Text>
        <Text>{disabled ? 'radio-disabled' : 'radio-enabled'}</Text>
        {options.map((option) => (
          <Pressable
            key={option.value}
            testID={`feedback-mode-${option.value}`}
            onPress={() => onValueChange?.(option.value)}
          >
            <Text>{option.label}</Text>
            <Text>{option.description}</Text>
          </Pressable>
        ))}
      </View>
    ),
    SwitchField: ({
      label,
      description,
      value,
      disabled,
      onValueChange,
    }: {
      label: string;
      description?: string;
      value: boolean;
      disabled?: boolean;
      onValueChange?: (value: boolean) => void;
    }) => (
      <Pressable
        accessibilityRole='switch'
        accessibilityLabel={label}
        testID='reinforcement-toggle'
        disabled={disabled}
        onPress={() => onValueChange?.(!value)}
      >
        <Text>{label}</Text>
        <Text>{description}</Text>
        <Text>{value ? 'on' : 'off'}</Text>
        <Text>{disabled ? 'switch-disabled' : 'switch-enabled'}</Text>
      </Pressable>
    ),
    ThemedText: ({ children }: { children?: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

const createReinforcementState = (
  overrides: Partial<ReinforcementDemoState> = {},
): ReinforcementDemoState => ({
  clientKey: 'frontend-demo',
  enabled: false,
  setEnabled: jest.fn(),
  markPresent: true,
  setMarkPresent: jest.fn(),
  busy: false,
  error: null,
  feedbackCount: 0,
  feedbackPoints: [],
  hasReinforcedHead: false,
  isActive: false,
  activationThreshold: 5,
  headVariant: 'original',
  lastResult: null,
  submitFeedback: jest.fn(),
  resetHead: jest.fn(async () => {}),
  ...overrides,
});

describe('ReinforcementDemoSection', () => {
  it('renders the disabled description and hides advanced controls when toggled off', () => {
    const reinforcement = createReinforcementState();

    render(
      <ReinforcementDemoSection
        reinforcement={reinforcement}
        disabled={true}
      />,
    );

    expect(screen.getByText('Personalized head fine-tuning')).toBeTruthy();
    expect(
      screen.getByText('Requires the inference heatmap for this species.'),
    ).toBeTruthy();
    expect(screen.queryByText('Feedback mode')).toBeNull();

    fireEvent.press(screen.getByTestId('reinforcement-toggle'));
    expect(reinforcement.setEnabled).not.toHaveBeenCalled();
  });

  it('renders the enabled active state, allows mode switching, and resets the personalized head', () => {
    const reinforcement = createReinforcementState({
      enabled: true,
      markPresent: false,
      feedbackCount: 5,
      hasReinforcedHead: true,
      isActive: true,
      activationThreshold: 5,
      lastResult: {
        speciesKey: 10,
        feedbackCount: 5,
        point: { lat: 1, lon: 2, present: false },
        originalScore: 0.1234,
        reinforcedScore: 0.5678,
        active: true,
        activationThreshold: 5,
      },
      error: 'Temporary backend issue',
    });

    render(<ReinforcementDemoSection reinforcement={reinforcement} />);

    expect(screen.getByText('Feedback mode')).toBeTruthy();
    expect(screen.getByText('Selected mode: absent')).toBeTruthy();
    expect(screen.getByText('Feedback points: 5')).toBeTruthy();
    expect(screen.getByText('Head: private clone ready')).toBeTruthy();
    expect(screen.getByText('Personalized tiles active.')).toBeTruthy();
    expect(screen.getByText('Last point score: 0.123 → 0.568')).toBeTruthy();
    expect(screen.getByText('Temporary backend issue')).toBeTruthy();
    expect(screen.getByText('enabled')).toBeTruthy();

    fireEvent.press(screen.getByTestId('feedback-mode-present'));
    fireEvent.press(screen.getByTestId('feedback-mode-absent'));
    fireEvent.press(screen.getByTestId('reinforcement-toggle'));
    fireEvent.press(screen.getByTestId('reset-personalized-head'));

    expect(reinforcement.setMarkPresent).toHaveBeenCalledWith(true);
    expect(reinforcement.setMarkPresent).toHaveBeenCalledWith(false);
    expect(reinforcement.setEnabled).toHaveBeenCalledWith(false);
    expect(reinforcement.resetHead).toHaveBeenCalled();
  });

  it('renders pending activation messaging and disables reset while busy or before a head exists', () => {
    const reinforcement = createReinforcementState({
      enabled: true,
      busy: true,
      feedbackCount: 4,
      hasReinforcedHead: false,
      isActive: false,
      activationThreshold: 6,
    });

    const { rerender } = render(
      <ReinforcementDemoSection reinforcement={reinforcement} />,
    );

    expect(
      screen.getByText(
        'Need 2 more feedback point(s) to activate personalized tiles.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Head: not started')).toBeTruthy();
    expect(screen.getByText('radio-disabled')).toBeTruthy();
    expect(screen.getByText('disabled')).toBeTruthy();

    rerender(
      <ReinforcementDemoSection
        reinforcement={createReinforcementState({
          enabled: true,
          busy: false,
          feedbackCount: 6,
          hasReinforcedHead: true,
          isActive: false,
          activationThreshold: 6,
        })}
      />,
    );

    expect(
      screen.getByText(
        'Activation threshold reached. Personalized tiles will activate once the private head update is ready.',
      ),
    ).toBeTruthy();
  });
});
