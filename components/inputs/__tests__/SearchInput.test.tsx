import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SearchInput } from '../SearchInput';

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

    fireEvent.press(screen.getByLabelText('Start search'));
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
    fireEvent.press(screen.getByLabelText('Clear search'));

    expect(handleClear).toHaveBeenCalled();
    expect(handleQueryChange).toHaveBeenCalledWith('');
    expect(screen.getByPlaceholderText('Search').props.value).toBe('');
    expect(screen.queryByLabelText('Clear search')).toBeNull();
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

    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(handleClear).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Search').props.value).toBe('owl');

    rerender(<SearchInput value="" onQueryChange={handleQueryChange} onClear={handleClear} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();
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


  it('disables editing when disabled prop is true', () => {
    render(<SearchInput disabled defaultValue="discoveries" />);

    const input = screen.getByPlaceholderText('Search');
    expect(input.props.editable).toBe(false);
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  it('does not submit when disabled and the icon is pressed', () => {
    const handleSubmit = jest.fn();
    render(<SearchInput disabled defaultValue="lynx" onSubmitSearch={handleSubmit} />);

    fireEvent.press(screen.getByLabelText('Start search'));

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});