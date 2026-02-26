import React from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RootLayout from '../_layout';
import { useFonts } from 'expo-font';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

// Get the mocked expo-router to access Stack's recorded props
const expoRouterMock = jest.requireMock('expo-router');

describe('Root layout', () => {
  afterEach(() => {
    mockUseFonts.mockReset();
    expoRouterMock.Stack.__recordedProps.length = 0;
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
    expect(expoRouterMock.Stack.__recordedProps.at(-1)?.screenOptions).toEqual({ headerShown: false });
  });
});
