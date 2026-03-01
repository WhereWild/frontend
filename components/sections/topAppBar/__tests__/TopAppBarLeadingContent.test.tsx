import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LeadingContent } from '../TopAppBarLeadingContent.native';
import { mockAnimatedTiming } from '../topAppBarTestUtils';

describe('TopAppBarLeadingContent', () => {
  beforeAll(() => {
    mockAnimatedTiming();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('renders search leading content with default placeholder and calls search handlers', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    render(
      <LeadingContent
        variant="search"
        searchValue=""
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />,
    );

    const input = screen.getByLabelText('Search input');
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();

    fireEvent.changeText(input, 'otter');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'otter' } });

    expect(onSearchValueChange).toHaveBeenCalledWith('otter');
    expect(onSubmitSearch).toHaveBeenCalledWith('otter');
  });

  it('renders page leading content and triggers onPressBack', () => {
    const onPressBack = jest.fn();

    render(
      <LeadingContent
        variant="page"
        title="Species"
        onPressBack={onPressBack}
      />,
    );

    expect(screen.getByText('Species')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onPressBack).toHaveBeenCalledTimes(1);
  });

  it('renders home leading content as image when logo is not pressable', () => {
    render(
      <LeadingContent
        variant="home"
        title="WhereWild"
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel="WhereWild logo"
      />,
    );

    expect(screen.getByLabelText('WhereWild logo')).toBeTruthy();
    expect(screen.getByText('WhereWild')).toBeTruthy();
  });

  it('renders home leading content with pressable logo when onPressLogo is provided', () => {
    const onPressLogo = jest.fn();

    render(
      <LeadingContent
        variant="home"
        title="WhereWild"
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel="WhereWild logo"
        onPressLogo={onPressLogo}
      />,
    );

    fireEvent.press(screen.getByLabelText('WhereWild logo'));
    expect(onPressLogo).toHaveBeenCalledTimes(1);
  });

  it('transitions leading content from page to search and back to page', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    const { rerender } = render(
      <LeadingContent
        variant="page"
        title="Species"
        onPressBack={jest.fn()}
      />,
    );

    rerender(
      <LeadingContent
        variant="search"
        searchValue=""
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />,
    );

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'fox');
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'fox' } });
    expect(onSearchValueChange).toHaveBeenCalledWith('fox');
    expect(onSubmitSearch).toHaveBeenCalledWith('fox');

    rerender(
      <LeadingContent
        variant="page"
        title="Species Details"
        onPressBack={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('Search input')).toBeNull();
    expect(screen.getByText('Species Details')).toBeTruthy();
  });
});
