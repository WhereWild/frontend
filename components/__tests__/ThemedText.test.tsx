import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemedText } from '../ThemedText';
import { useTypographyStyles } from '@/hooks/useTypographyStyles';

jest.mock('@/hooks/useTypographyStyles');

const mockUseTypographyStyles = useTypographyStyles as jest.MockedFunction<typeof useTypographyStyles>;

beforeEach(() => {
  mockUseTypographyStyles.mockReturnValue({
    body: { color: '#111111', fontSize: 16 },
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
});
