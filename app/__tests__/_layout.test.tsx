import React from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RootLayout from '../_layout';
import { useFonts } from 'expo-font';
import { usePathname, useRouter } from 'expo-router';
import { Time } from '@/constants/theme';

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
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Root layout', () => {
  afterEach(() => {
    mockUseFonts.mockReset();
    mockUseRouter.mockReset();
    mockUsePathname.mockReset();
    recordedStackProps.length = 0;
  });

  it('renders nothing until fonts are loaded', () => {
    mockUseFonts.mockReturnValue([false, null]);
    mockUseRouter.mockReturnValue({ push: jest.fn() } as never);
    mockUsePathname.mockReturnValue('/');

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('app-stack')).toBeNull();
  });

  it('renders the navigation stack once fonts are available', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseRouter.mockReturnValue({ push: jest.fn() } as never);
    mockUsePathname.mockReturnValue('/');

    render(<RootLayout />);

    expect(screen.getByTestId('app-stack')).toBeTruthy();
    expect(recordedStackProps.at(-1)?.screenOptions).toEqual({
      headerShown: false,
      animation: 'fade',
      animationDuration: Time.duration.short,
    });
  });
});
