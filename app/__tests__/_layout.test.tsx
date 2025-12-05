import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import React from 'react';
import { View } from 'react-native';
import RootLayout from '../_layout';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

jest.mock('@/components/sections/PageHeaderPortal', () => {
  const React = require('react');
  const { View: RNView } = require('react-native');
  return {
    PageHeaderPortalProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    PageHeaderPortal: () => <RNView testID="page-header-portal" />,
  };
});

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
    expect(screen.queryByTestId('page-header-portal')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(screen.getByTestId('page-header-portal')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({ headerShown: false });
  });
});
