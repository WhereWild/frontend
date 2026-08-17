// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import React from 'react';
import { Markdown } from '../Markdown';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

// Real useResponsive() (via ThemedText -> useTypographyStyles) adds a
// window resize listener on web, which this non-jsdom test environment's
// `window` global doesn't support — mock it out like other page tests do.
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ breakpoint: 'desktop', rootFontSize: 16 }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

type DomStub = {
  scrollIntoView: jest.Mock;
  getElementById: jest.Mock;
  replaceState: jest.Mock;
  hash: string;
};

const withPlatformOS = (platform: string, run: () => void) => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: platform,
  });

  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  }
};

describe('Markdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
  });

  it('renders headings at each depth with distinct emphasis', () => {
    render(<Markdown>{'# H1\n\n## H2\n\n### H3\n\n#### H4'}</Markdown>);

    expect(screen.getByText('H1')).toBeTruthy();
    expect(screen.getByText('H2')).toBeTruthy();
    expect(screen.getByText('H3')).toBeTruthy();
    expect(screen.getByText('H4')).toBeTruthy();
  });

  it('renders a plain paragraph', () => {
    render(<Markdown>{'Just a sentence.'}</Markdown>);

    expect(screen.getByText('Just a sentence.')).toBeTruthy();
  });

  it('renders bold and italic text within a paragraph', () => {
    render(<Markdown>{'Some **bold** and _italic_ text.'}</Markdown>);

    expect(screen.getByText('bold')).toBeTruthy();
    expect(screen.getByText('italic')).toBeTruthy();
  });

  it('renders strikethrough text', () => {
    render(<Markdown>{'Some ~~removed~~ text.'}</Markdown>);

    expect(screen.getByText('removed')).toBeTruthy();
  });

  it('renders inline code', () => {
    render(<Markdown>{'Run `npm test` to check.'}</Markdown>);

    expect(screen.getByText('npm test')).toBeTruthy();
  });

  it('renders a fenced code block', () => {
    render(<Markdown>{'```\nconst x = 1;\n```'}</Markdown>);

    expect(screen.getByText('const x = 1;')).toBeTruthy();
  });

  it('navigates internally for a link starting with "/"', () => {
    render(<Markdown>{'See the [search page](/search) for more.'}</Markdown>);

    fireEvent.press(screen.getByText('search page'));

    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('opens external links via Linking', () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);

    render(
      <Markdown>{'See [GBIF](https://www.gbif.org/) for more.'}</Markdown>,
    );

    fireEvent.press(screen.getByText('GBIF'));

    expect(openUrlSpy).toHaveBeenCalledWith('https://www.gbif.org/');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders an unordered list', () => {
    render(<Markdown>{'- First item\n- Second item'}</Markdown>);

    expect(screen.getByText('First item')).toBeTruthy();
    expect(screen.getByText('Second item')).toBeTruthy();
    expect(screen.getAllByText('•').length).toBe(2);
  });

  it('renders an ordered list with sequential numbering', () => {
    render(<Markdown>{'1. First\n2. Second\n3. Third'}</Markdown>);

    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
    expect(screen.getByText('3.')).toBeTruthy();
  });

  it('renders a blockquote', () => {
    render(<Markdown>{'> A quoted line.'}</Markdown>);

    expect(screen.getByText('A quoted line.')).toBeTruthy();
  });

  it('renders nothing for empty input', () => {
    render(<Markdown>{''}</Markdown>);

    expect(screen.queryAllByText(/.+/).length).toBe(0);
  });

  describe('heading anchors', () => {
    it('assigns a slugified nativeID to each heading on web', () => {
      withPlatformOS('web', () => {
        const { UNSAFE_getByProps } = render(
          <Markdown>{'# Getting Started\n\n## The API'}</Markdown>,
        );

        expect(UNSAFE_getByProps({ nativeID: 'getting-started' })).toBeTruthy();
        expect(UNSAFE_getByProps({ nativeID: 'the-api' })).toBeTruthy();
      });
    });

    it('de-dupes slugs for repeated heading text', () => {
      withPlatformOS('web', () => {
        const { UNSAFE_getByProps } = render(
          <Markdown>{'## Overview\n\nSome text.\n\n## Overview'}</Markdown>,
        );

        expect(UNSAFE_getByProps({ nativeID: 'overview' })).toBeTruthy();
        expect(UNSAFE_getByProps({ nativeID: 'overview-1' })).toBeTruthy();
      });
    });

    it('does not assign a nativeID on native platforms', () => {
      withPlatformOS('ios', () => {
        const { UNSAFE_queryByProps } = render(
          <Markdown>{'# Title'}</Markdown>,
        );

        expect(UNSAFE_queryByProps({ nativeID: 'title' })).toBeFalsy();
      });
    });

    // This test environment has no jsdom (see jest.config.js's
    // testEnvironment: 'node'), so `document` isn't a real global here —
    // stub just enough of it/`window` to exercise Markdown's web-only DOM
    // calls, then tear the stub down.
    const withDomStub = (initialHash: string, run: (stub: DomStub) => void) => {
      const stub: DomStub = {
        scrollIntoView: jest.fn(),
        getElementById: jest.fn(),
        replaceState: jest.fn(),
        hash: initialHash,
      };
      stub.getElementById.mockImplementation(() => ({
        scrollIntoView: stub.scrollIntoView,
      }));
      const originalDocument = (global as { document?: unknown }).document;
      const originalLocation = window.location;
      const originalHistory = window.history;
      (global as { document?: unknown }).document = {
        getElementById: stub.getElementById,
      };
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { hash: stub.hash },
      });
      Object.defineProperty(window, 'history', {
        configurable: true,
        value: { replaceState: stub.replaceState },
      });

      try {
        run(stub);
      } finally {
        (global as { document?: unknown }).document = originalDocument;
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: originalLocation,
        });
        Object.defineProperty(window, 'history', {
          configurable: true,
          value: originalHistory,
        });
      }
    };

    it('scrolls to and updates the URL for an in-page hash link, without navigating', () => {
      withPlatformOS('web', () => {
        withDomStub('', ({ getElementById, scrollIntoView, replaceState }) => {
          render(
            <Markdown>
              {'## The API\n\nSee the [API section](#the-api).'}
            </Markdown>,
          );
          fireEvent.press(screen.getByText('API section'));

          expect(getElementById).toHaveBeenCalledWith('the-api');
          expect(scrollIntoView).toHaveBeenCalled();
          expect(replaceState).toHaveBeenCalledWith(null, '', '#the-api');
          expect(mockPush).not.toHaveBeenCalled();
        });
      });
    });

    it('scrolls to the section matching an incoming URL hash on mount', () => {
      withPlatformOS('web', () => {
        withDomStub('#the-api', ({ getElementById, scrollIntoView }) => {
          render(<Markdown>{'## The API'}</Markdown>);

          expect(getElementById).toHaveBeenCalledWith('the-api');
          expect(scrollIntoView).toHaveBeenCalled();
        });
      });
    });
  });
});
