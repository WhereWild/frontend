// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';
import React from 'react';
import { WebPageFooter } from '../WebPageFooter';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;

describe('WebPageFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      contentWidth: 1200,
      gap: 32,
      marginHorizontal: 32,
    } as any);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: null, api_build_date: null }),
    });
  });

  it('opens the WhereWild GitHub org page when the GitHub icon is pressed', () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);

    render(<WebPageFooter />);

    fireEvent.press(screen.getByLabelText('WhereWild on GitHub'));

    expect(openUrlSpy).toHaveBeenCalledWith('https://github.com/WhereWild');
  });

  it('does not render a Discord link', () => {
    render(<WebPageFooter />);

    expect(screen.queryByLabelText('WhereWild on Discord')).toBeNull();
  });

  it('navigates to the Acknowledgements page when pressed', () => {
    render(<WebPageFooter />);

    fireEvent.press(screen.getByText('Acknowledgements'));

    expect(mockPush).toHaveBeenCalledWith('/acknowledgements');
  });

  it('navigates to the Status page when pressed', () => {
    render(<WebPageFooter />);

    fireEvent.press(screen.getByText('Status'));

    expect(mockPush).toHaveBeenCalledWith('/status');
  });

  it('links to every internal page', () => {
    render(<WebPageFooter />);

    const expectedLinks: [label: string, route: string][] = [
      ['Home', '/'],
      ['Search', '/search'],
      ['Maps', '/maps'],
      ['Upload', '/upload'],
      ['Help', '/help'],
      ['Guides', '/guides'],
      ['About', '/about'],
      ['Settings', '/settings'],
      ['Status', '/status'],
      ['Acknowledgements', '/acknowledgements'],
    ];

    for (const [label, route] of expectedLinks) {
      fireEvent.press(screen.getByText(label));
      expect(mockPush).toHaveBeenLastCalledWith(route);
    }
  });

  it('renders a "|" separator between every link', () => {
    render(<WebPageFooter />);

    // 10 internal links -> 9 separators between them.
    expect(screen.getAllByText('  |  ').length).toBe(9);
  });

  it('still links to every internal page when stacked on a phone-width viewport', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      contentWidth: 400,
      gap: 16,
      marginHorizontal: 16,
    } as any);

    render(<WebPageFooter />);

    fireEvent.press(screen.getByText('Maps'));

    expect(mockPush).toHaveBeenCalledWith('/maps');
  });

  it('renders a copyright line and a last-build line', () => {
    render(<WebPageFooter />);

    expect(screen.getByText(/© \d{4} The WhereWild Contributors/)).toBeTruthy();
    expect(screen.getByText(/^Website last build /)).toBeTruthy();
  });

  it('omits the GBIF crawl date and API build date lines when /version has none', async () => {
    render(<WebPageFooter />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    expect(screen.queryByText(/last crawled/)).toBeNull();
    expect(screen.queryByText(/^API last build /)).toBeNull();
  });

  it('renders the bare GBIF crawl date (no inline status link) and the API build date', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '2026-08-01T00:00:00.000Z',
        api_build_date: '2026-08-10T12:00:00Z',
      }),
    });

    render(<WebPageFooter />);

    await waitFor(() =>
      expect(
        screen.getByText(
          /iNaturalist occurrence data \(via GBIF\) last crawled/,
        ),
      ).toBeTruthy(),
    );

    expect(screen.queryByText(/for more/)).toBeNull();
    expect(screen.queryByText('see status page')).toBeNull();
    expect(screen.getByText(/^API last build /)).toBeTruthy();
  });
});
