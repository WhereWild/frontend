// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import React from 'react';
import { Markdown } from '../Markdown';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

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
});
