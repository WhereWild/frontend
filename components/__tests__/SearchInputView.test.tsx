import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { SearchInputView, type IconButtonSlotProps } from '../inputs/SearchInputView';

describe('SearchInputView', () => {
  const createSlot = (overrides: Partial<IconButtonSlotProps> = {}): IconButtonSlotProps => ({
    onPress: jest.fn(),
    accessibilityLabel: 'slot',
    testID: 'slot-id',
    disabled: false,
    hitSlop: undefined,
    style: () => [],
    renderIcon: () => <Text>icon</Text>,
    ...overrides,
  });

  const handlers = {
    onPress: jest.fn(),
    onHoverIn: jest.fn(),
    onHoverOut: jest.fn(),
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  };

  it('renders clear slot', () => {
    const inputRef = React.createRef<TextInput>();

    const { getByTestId } = render(
      <SearchInputView
        disabled={false}
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ testID: 'search-slot' })}
        clearButton={createSlot({ testID: 'clear-slot' })}
        inputProps={{
          style: { paddingHorizontal: 24 },
          value: '',
          onChangeText: jest.fn(),
          placeholder: 'Search',
        }}
        inputRef={inputRef}
      />,
    );

    expect(getByTestId('clear-slot')).toBeTruthy();
  });

  it('omits clear slot when not provided', () => {
    const inputRef = React.createRef<TextInput>();

    const { queryByTestId } = render(
      <SearchInputView
        disabled
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ testID: 'search-slot' })}
        inputProps={{
          style: [StyleSheet.create({})],
          value: '',
          onChangeText: jest.fn(),
          placeholder: 'Search',
        }}
        inputRef={inputRef}
      />,
    );

    expect(queryByTestId('clear-slot')).toBeNull();
  });

  it('maintains baseline styles when no input style is provided', () => {
    const inputRef = React.createRef<TextInput>();

    const { getByPlaceholderText } = render(
      <SearchInputView
        disabled={false}
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ testID: 'search-slot' })}
        inputProps={{
          value: '',
          onChangeText: jest.fn(),
          placeholder: 'Search',
        }}
        inputRef={inputRef}
      />,
    );

    const styleProp = getByPlaceholderText('Search').props.style;
    const styles = Array.isArray(styleProp) ? styleProp : [styleProp];
    expect(styles[0]).toBeTruthy();
    expect(styles[1]).toBeNull();
  });

  it('resets outlines for web platform styles', () => {
    jest.isolateModules(() => {
      const RN = jest.requireActual('react-native');
      const originalDescriptor = Object.getOwnPropertyDescriptor(RN.Platform, 'OS');
      Object.defineProperty(RN.Platform, 'OS', { configurable: true, value: 'web' });
      const { styles } = jest.requireActual('../inputs/SearchInputView').__SEARCH_INPUT_VIEW_TESTING__;
      const containerStyle = StyleSheet.flatten(styles.container);
      expect(containerStyle).toMatchObject({ outlineStyle: 'none' });
      if (originalDescriptor) {
        Object.defineProperty(RN.Platform, 'OS', originalDescriptor);
      }
    });
  });
});