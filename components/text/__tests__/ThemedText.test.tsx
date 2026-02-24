import { useTypographyStyles } from '@/hooks/useTypographyStyles';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemedText } from '../ThemedText';

jest.mock('@/hooks/useTypographyStyles');

const mockUseTypographyStyles = useTypographyStyles as jest.MockedFunction<typeof useTypographyStyles>;

beforeEach(() => {
  mockUseTypographyStyles.mockReturnValue({
    body: { color: '#111111', fontSize: 16 },
    bodySmallLink: { color: '#006600', fontSize: 12 },
    link: { color: '#00ff00', fontSize: 14 },
  } as any);
});

describe('ThemedText', () => {
  it('defaults to body variant styles', () => {
    render(<ThemedText>Hello</ThemedText>);
    const text = screen.getByText('Hello');
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#111111', fontSize: 16 })])
    );
  });

  it('applies requested variant and merges custom styles', () => {
    render(
      <ThemedText variant="link" style={{ textTransform: 'uppercase' }}>
        Read More
      </ThemedText>
    );

    const text = screen.getByText('Read More');
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#00ff00' }),
        expect.objectContaining({ textTransform: 'uppercase' }),
      ])
    );
  });

  it('applies bodySmallLink variant styles', () => {
    render(<ThemedText variant="bodySmallLink">Learn More</ThemedText>);

    const text = screen.getByText('Learn More');
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#006600', fontSize: 12 }),
      ])
    );
  });

  it('warns and falls back when an unknown variant is provided', () => {
    const originalDev = __DEV__;
    (global as any).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <ThemedText variant={'mystery' as any}>
        Unknown
      </ThemedText>,
    );

    expect(warnSpy).toHaveBeenCalledWith(
      'ThemedText: unknown variant "mystery". Falling back to "body".',
    );
    warnSpy.mockRestore();
    (global as any).__DEV__ = originalDev;
  });
});
