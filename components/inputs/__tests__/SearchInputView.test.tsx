// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import {
  SearchInputView,
  type SearchInputIconButtonProps,
} from '../SearchInputView';

describe('SearchInputView', () => {
  const createSlot = (
    overrides: Partial<SearchInputIconButtonProps> = {},
  ): SearchInputIconButtonProps => ({
    onPress: jest.fn(),
    accessibilityLabel: 'slot',
    disabled: false,
    icon: <Text>icon</Text>,
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

    const { getByLabelText } = render(
      <SearchInputView
        disabled={false}
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ accessibilityLabel: 'search-slot' })}
        clearButton={createSlot({ accessibilityLabel: 'clear-slot' })}
        inputProps={{
          style: { paddingHorizontal: 24 },
          value: '',
          onChangeText: jest.fn(),
          placeholder: 'Search',
        }}
        inputRef={inputRef}
      />,
    );

    expect(getByLabelText('clear-slot')).toBeTruthy();
  });

  it('omits clear slot when not provided', () => {
    const inputRef = React.createRef<TextInput>();

    const { queryByLabelText } = render(
      <SearchInputView
        disabled
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ accessibilityLabel: 'search-slot' })}
        inputProps={{
          style: [StyleSheet.create({})],
          value: '',
          onChangeText: jest.fn(),
          placeholder: 'Search',
        }}
        inputRef={inputRef}
      />,
    );

    expect(queryByLabelText('clear-slot')).toBeNull();
  });

  it('maintains baseline styles when no input style is provided', () => {
    const inputRef = React.createRef<TextInput>();

    const { getByPlaceholderText } = render(
      <SearchInputView
        disabled={false}
        containerStyle={[null]}
        containerHandlers={handlers}
        searchButton={createSlot({ accessibilityLabel: 'search-slot' })}
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
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        RN.Platform,
        'OS',
      );
      Object.defineProperty(RN.Platform, 'OS', {
        configurable: true,
        value: 'web',
      });
      const { styles } =
        jest.requireActual('../SearchInputView').__SEARCH_INPUT_VIEW_TESTING__;
      const containerStyle = StyleSheet.flatten(styles.container);
      expect(containerStyle).toMatchObject({ outlineStyle: 'none' });
      if (originalDescriptor) {
        Object.defineProperty(RN.Platform, 'OS', originalDescriptor);
      }
    });
  });

  it('pins the control to the semantic medium height with centered input text', () => {
    const { styles } =
      jest.requireActual('../SearchInputView').__SEARCH_INPUT_VIEW_TESTING__;
    const containerStyle = StyleSheet.flatten(styles.container);
    const inputStyle = StyleSheet.flatten(styles.input);

    expect(containerStyle).toMatchObject({
      minHeight: 40,
    });
    expect(inputStyle).toMatchObject({
      height: '100%',
      padding: 0,
      textAlignVertical: 'center',
    });
  });
});
