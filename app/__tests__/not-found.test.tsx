// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NotFoundScreen from '../+not-found';
import { useRouter } from 'expo-router';

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: jest.fn(),
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const createRouterMock = () =>
  ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    refresh: jest.fn(),
  }) as unknown as ReturnType<typeof useRouter>;

describe('NotFoundScreen', () => {
  let router: ReturnType<typeof createRouterMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    router = createRouterMock();
    mockUseRouter.mockReturnValue(router);
  });

  it('renders a not-found message', () => {
    render(<NotFoundScreen />);

    expect(screen.getByText('Page not found')).toBeTruthy();
    expect(
      screen.getByText("We couldn't find the page you were looking for."),
    ).toBeTruthy();
  });

  it('navigates home when the link is pressed', () => {
    render(<NotFoundScreen />);

    fireEvent.press(screen.getByText('Go back home'));

    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
