import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconFilter } from '@/assets/icons';
import { LeadingContent, PrimaryAction } from '../TopAppBarParts.native';

describe('TopAppBarParts', () => {
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

  it('returns null when primary action is disabled by hasPrimaryButton=false', () => {
    const { toJSON } = render(
      <PrimaryAction
        hasPrimaryButton={false}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={jest.fn()}
        primaryIconButtonAccessibilityLabel="Filter action"
        primaryButtonAccessibilityLabel="Filter"
        primaryButtonLabel="Filter"
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('renders primary icon action and disables it when no handler is provided', () => {
    render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={true}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={undefined}
        primaryIconButtonAccessibilityLabel="Filter action"
        primaryButtonAccessibilityLabel="Filter"
        primaryButtonLabel="Filter"
      />,
    );

    expect(screen.getByLabelText('Filter action')).toBeDisabled();
  });

  it('renders primary text action and calls handler on press', () => {
    const onPressPrimaryButton = jest.fn();

    render(
      <PrimaryAction
        hasPrimaryButton={true}
        shouldRenderPrimaryAsIcon={false}
        primaryButtonIcon={<IconFilter />}
        onPressPrimaryButton={onPressPrimaryButton}
        primaryIconButtonAccessibilityLabel="Filter action"
        primaryButtonAccessibilityLabel="Filter"
        primaryButtonLabel="Filter"
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter'));
    expect(onPressPrimaryButton).toHaveBeenCalledTimes(1);
  });
});
