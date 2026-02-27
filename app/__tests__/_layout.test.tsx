import React from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RootLayout from '../_layout';
import { useFonts } from 'expo-font';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

const recordedStackProps: any[] = [];

function mockStack(props: any) {
  recordedStackProps.push(props);
  return <View testID="app-stack" />;
}

jest.mock('expo-router', () => ({
  Stack: mockStack,
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

describe('Root layout', () => {
  afterEach(() => {
    mockUseFonts.mockReset();
    recordedStackProps.length = 0;
  });

  it('renders nothing until fonts are loaded', () => {
    mockUseFonts.mockReturnValue([false, null]);

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('app-stack')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({ headerShown: false });
  });
});
