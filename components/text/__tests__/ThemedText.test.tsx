import { useTypographyStyles } from '@/hooks/useTypographyStyles';
import { Time } from '@/constants/theme';
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated, Platform } from 'react-native';
import { ThemedText } from '../ThemedText';

jest.mock('@/hooks/useTypographyStyles');

const mockUseTypographyStyles = useTypographyStyles as jest.MockedFunction<typeof useTypographyStyles>;

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

beforeEach(() => {
  mockUseTypographyStyles.mockReturnValue({
    body: { color: '#111111', fontSize: 16 },
    bodySmallLink: { color: '#006600', fontSize: 12, textDecorationLine: 'underline', textDecorationColor: 'transparent' },
    link: { color: '#00ff00', fontSize: 14, textDecorationLine: 'underline', textDecorationColor: 'transparent' },
  } as any);
});

describe('ThemedText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to body variant styles', () => {
    render(<ThemedText>Hello</ThemedText>);
    const text = screen.getByText('Hello');
    const style = text.props.style;

    expect(style).toEqual(expect.objectContaining({ color: '#111111', fontSize: 16 }));
    expect(style).toEqual(expect.not.objectContaining({ textDecorationLine: 'underline' }));
    expect(style).toEqual(expect.not.objectContaining({ textDecorationColor: expect.anything() }));
  });

  it('applies requested variant and merges custom styles', () => {
    render(
      <ThemedText variant="link" style={{ textTransform: 'uppercase' }}>
        Read More
      </ThemedText>
    );

    const text = screen.getByText('Read More');
    expect(text.props.style).toEqual(
      expect.objectContaining({ color: '#00ff00', textTransform: 'uppercase' })
    );
  });

  it('applies bodySmallLink variant styles', () => {
    render(<ThemedText variant="bodySmallLink">Learn More</ThemedText>);

    const text = screen.getByText('Learn More');
    expect(text.props.style).toEqual(expect.objectContaining({ color: '#006600', fontSize: 12 }));
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

  it('animates link underline in and out using time tokens', () => {
    withPlatformOS('ios', () => {
      const startMock = jest.fn();
      const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
        start: startMock,
      } as any);

      render(<ThemedText variant="link">Read More</ThemedText>);
      const text = screen.getByText('Read More');

      expect(text.props.style).toEqual(expect.objectContaining({ color: '#00ff00' }));

      act(() => {
        text.props.onHoverIn({} as any);
      });

      act(() => {
        screen.getByText('Read More').props.onHoverOut({} as any);
      });

      expect(timingSpy).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.objectContaining({
          toValue: 1,
          duration: Time.duration.short,
          useNativeDriver: false,
        })
      );
      expect(timingSpy).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.objectContaining({
          toValue: 0,
          duration: Time.duration.short,
          useNativeDriver: false,
        })
      );
      expect(startMock).toHaveBeenCalledTimes(2);
    });
  });

  it('animates bodySmallLink underline on press interactions', () => {
    withPlatformOS('ios', () => {
      const startMock = jest.fn();
      const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
        start: startMock,
      } as any);

      render(<ThemedText variant="bodySmallLink">Learn More</ThemedText>);
      const text = screen.getByText('Learn More');

      act(() => {
        text.props.onPressIn({} as any);
      });
      act(() => {
        text.props.onPressOut({} as any);
      });

      expect(timingSpy).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.objectContaining({
          toValue: 1,
          duration: Time.duration.short,
        })
      );
      expect(timingSpy).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.objectContaining({
          toValue: 0,
          duration: Time.duration.short,
        })
      );
      expect(startMock).toHaveBeenCalledTimes(2);
    });
  });

  it('fades link underline in and out on web using mouse handlers and time tokens', () => {
    withPlatformOS('web', () => {
      const timingSpy = jest.spyOn(Animated, 'timing');

      render(<ThemedText variant="link">Read More</ThemedText>);
      const text = screen.getByText('Read More');

      expect(text.props.style).toEqual(
        expect.objectContaining({
          textDecorationColor: 'transparent',
          transitionDuration: `${Time.duration.short}ms`,
        })
      );

      act(() => {
        text.props.onMouseEnter({} as any);
      });
      expect(screen.getByText('Read More').props.style).toEqual(
        expect.objectContaining({ textDecorationColor: '#00ff00' })
      );

      act(() => {
        screen.getByText('Read More').props.onMouseLeave({} as any);
      });
      expect(screen.getByText('Read More').props.style).toEqual(
        expect.objectContaining({ textDecorationColor: 'transparent' })
      );

      expect(timingSpy).not.toHaveBeenCalled();
    });
  });

  it('does not attach animation handlers for non-link variants', () => {
    render(<ThemedText variant="body">Body</ThemedText>);
    const text = screen.getByText('Body');

    expect(text.props.onHoverIn).toBeUndefined();
    expect(text.props.onHoverOut).toBeUndefined();
    expect(text.props.onPressIn).toBeUndefined();
    expect(text.props.onPressOut).toBeUndefined();
  });
});
