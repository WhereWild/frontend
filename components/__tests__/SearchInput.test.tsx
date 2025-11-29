import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SearchInput, __SEARCH_INPUT_TESTING__ } from '../SearchInput';
import { Typography } from '@/constants/theme';

describe('SearchInput', () => {
  it('renders placeholder text', () => {
    render(<SearchInput placeholder="Search Species" />);
    expect(screen.getByPlaceholderText('Search Species')).toBeTruthy();
  });

  it('fires change and character events when typing', () => {
    const handleQueryChange = jest.fn();
    const handleCharacterAdd = jest.fn();
    render(
      <SearchInput
        placeholder="Search"
        onQueryChange={handleQueryChange}
        onCharacterAdd={handleCharacterAdd}
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.changeText(input, 'w');
    fireEvent.changeText(input, 'wi');
    fireEvent.changeText(input, 'w'); // simulate deletion

    expect(handleQueryChange).toHaveBeenCalledTimes(3);
    expect(handleQueryChange).toHaveBeenNthCalledWith(1, 'w');
    expect(handleQueryChange).toHaveBeenNthCalledWith(2, 'wi');
    expect(handleQueryChange).toHaveBeenNthCalledWith(3, 'w');
    expect(handleCharacterAdd).toHaveBeenCalledTimes(2);
    expect(handleCharacterAdd).toHaveBeenNthCalledWith(1, 'w', 'w');
    expect(handleCharacterAdd).toHaveBeenNthCalledWith(2, 'i', 'wi');
  });

  it('submits the search when the icon is pressed', () => {
    const handleSubmit = jest.fn();
    render(
      <SearchInput
        defaultValue="lynx"
        onSubmitSearch={handleSubmit}
      />,
    );

    fireEvent.press(screen.getByTestId('search-input-icon'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('lynx');
  });

  it('submits the search when return/enter is pressed', () => {
    const handleSubmit = jest.fn();
    render(
      <SearchInput
        defaultValue="lynx"
        onSubmitSearch={handleSubmit}
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.changeText(input, 'lynx habitat');
    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'lynx habitat' } });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('lynx habitat');
  });

  it('falls back to the last typed value when submitEditing has no text payload', () => {
    // Some RN platforms omit nativeEvent.text; verify we still submit what the user typed.
    const handleSubmit = jest.fn();
    render(
      <SearchInput
        defaultValue="lynx"
        onSubmitSearch={handleSubmit}
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.changeText(input, 'cougar');
    fireEvent(input, 'submitEditing', { nativeEvent: {} });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('cougar');
  });

  it('clears text when the X icon is pressed', () => {
    const handleClear = jest.fn();
    const handleQueryChange = jest.fn();
    render(
      <SearchInput
        placeholder="Search"
        onClear={handleClear}
        onQueryChange={handleQueryChange}
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.changeText(input, 'owl');
    fireEvent.press(screen.getByTestId('search-input-clear'));

    expect(handleClear).toHaveBeenCalled();
    expect(handleQueryChange).toHaveBeenCalledWith('');
    expect(screen.getByPlaceholderText('Search').props.value).toBe('');
    expect(screen.queryByTestId('search-input-clear')).toBeNull();
  });

  it('keeps rendered value controlled by props', () => {
    const handleQueryChange = jest.fn();
    const handleClear = jest.fn();
    const { rerender } = render(
      <SearchInput value="owl" onQueryChange={handleQueryChange} onClear={handleClear} />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.changeText(input, 'hawk');

    expect(handleQueryChange).toHaveBeenCalledWith('hawk');
    expect(input.props.value).toBe('owl');

    fireEvent.press(screen.getByTestId('search-input-clear'));
    expect(handleClear).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Search').props.value).toBe('owl');

    rerender(<SearchInput value="" onQueryChange={handleQueryChange} onClear={handleClear} />);
    expect(screen.queryByTestId('search-input-clear')).toBeNull();
  });

  it('keeps overall width and height unchanged when focused', () => {
    render(<SearchInput placeholder="Search" defaultValue="lynx" />);

    const flatten = (node: any) => StyleSheet.flatten(node?.props?.style) ?? {};
    const iconVisualSize = 16;

    const computeDimensions = () => {
      const containerStyle = flatten(screen.getByRole('search'));
      const iconStartStyle = flatten(screen.getByTestId('search-input-icon'));
      const inputStyle = flatten(screen.getByPlaceholderText('Search'));
      const iconEndStyle = flatten(screen.getByTestId('search-input-clear'));

      const numeric = (value: unknown) => (typeof value === 'number' ? value : 0);

      const containerHorizontal = numeric(containerStyle.paddingHorizontal);
      const containerVertical = numeric(containerStyle.paddingVertical);
      const containerBorder = numeric(containerStyle.borderWidth);

      const iconStartHorizontal = numeric(iconStartStyle.paddingHorizontal);
      const iconStartVertical = numeric(iconStartStyle.paddingVertical);

      const iconEndHorizontal = numeric(iconEndStyle.paddingHorizontal);
      const iconEndVertical = numeric(iconEndStyle.paddingVertical);

      const inputPaddingHorizontal = numeric(inputStyle.paddingHorizontal);
      const inputPaddingVertical = numeric(inputStyle.paddingVertical);
      const mode = 'light'; // Define mode for test
      const inputLineHeight = numeric(inputStyle.lineHeight) || numeric(Typography[mode].singleLineBody.lineHeight);

      const width =
        2 * (containerHorizontal + containerBorder) +
        (2 * iconStartHorizontal + iconVisualSize) +
        (2 * iconEndHorizontal + iconVisualSize) +
        2 * inputPaddingHorizontal;

      const contentHeight = Math.max(
        2 * iconStartVertical + iconVisualSize,
        2 * iconEndVertical + iconVisualSize,
        2 * inputPaddingVertical + inputLineHeight,
      );

      const height = 2 * (containerVertical + containerBorder) + contentHeight;

      return { width, height };
    };

    const initial = computeDimensions();

    fireEvent(screen.getByPlaceholderText('Search'), 'focus');

    const focused = computeDimensions();

    expect(focused.width).toBe(initial.width);
    expect(focused.height).toBe(initial.height);
  });

  it('forwards focus and blur callbacks', () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();

    render(<SearchInput onFocus={handleFocus} onBlur={handleBlur} />);

    const input = screen.getByPlaceholderText('Search');
    fireEvent(input, 'focus', {});
    fireEvent(input, 'blur', {});

    expect(handleFocus).toHaveBeenCalledTimes(1);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('does not submit when disabled and the icon is pressed', () => {
    const handleSubmit = jest.fn();
    render(<SearchInput disabled defaultValue="lynx" onSubmitSearch={handleSubmit} />);

    fireEvent.press(screen.getByTestId('search-input-icon'));

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe('SearchInput helpers', () => {
  it('does not clear when disabled', () => {
    const ref = { current: 'value' };
    const setInternalValue = jest.fn();
    const onQueryChange = jest.fn();
    const onClear = jest.fn();

    const result = __SEARCH_INPUT_TESTING__.handleClearValue({
      disabled: true,
      isControlled: false,
      setInternalValue,
      previousValueRef: ref,
      onQueryChange,
      onClear,
    });

    expect(result).toBe(false);
    expect(setInternalValue).not.toHaveBeenCalled();
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('clears value and notifies callbacks in uncontrolled mode', () => {
    const ref = { current: 'seed' };
    const setInternalValue = jest.fn();
    const onQueryChange = jest.fn();
    const onClear = jest.fn();

    const result = __SEARCH_INPUT_TESTING__.handleClearValue({
      disabled: false,
      isControlled: false,
      setInternalValue,
      previousValueRef: ref,
      onQueryChange,
      onClear,
    });

    expect(result).toBe(true);
    expect(ref.current).toBe('');
    expect(setInternalValue).toHaveBeenCalledWith('');
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('clears value without mutating internal state in controlled mode', () => {
    const ref = { current: 'seed' };
    const setInternalValue = jest.fn();
    const onQueryChange = jest.fn();
    const onClear = jest.fn();

    const result = __SEARCH_INPUT_TESTING__.handleClearValue({
      disabled: false,
      isControlled: true,
      setInternalValue,
      previousValueRef: ref,
      onQueryChange,
      onClear,
    });

    expect(result).toBe(true);
    expect(ref.current).toBe('');
    expect(setInternalValue).not.toHaveBeenCalled();
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('submits only when enabled', () => {
    const onSubmit = jest.fn();
    const disabledResult = __SEARCH_INPUT_TESTING__.submitSearchValue(true, 'lynx', onSubmit);
    const enabledResult = __SEARCH_INPUT_TESTING__.submitSearchValue(false, 'lynx', onSubmit);

    expect(disabledResult).toBe(false);
    expect(enabledResult).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith('lynx');
  });
});