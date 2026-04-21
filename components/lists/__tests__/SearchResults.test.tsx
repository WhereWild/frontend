import { render, screen, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SearchResults, __SEARCH_RESULTS_TESTING__ } from '../SearchResults';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesSummary } from '@/data/types';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

const withMockDomGlobals = <T,>(
  MockHTMLElement: new () => T,
  getElementById: (id: string) => T | null,
  run: () => void,
) => {
  const originalDocument = (global as { document?: unknown }).document;
  const originalHTMLElement = (global as { HTMLElement?: unknown }).HTMLElement;

  (global as { HTMLElement?: unknown }).HTMLElement = MockHTMLElement;
  (global as { document?: unknown }).document = { getElementById };

  try {
    run();
  } finally {
    if (originalDocument === undefined) {
      delete (global as { document?: unknown }).document;
    } else {
      (global as { document?: unknown }).document = originalDocument;
    }

    if (originalHTMLElement === undefined) {
      delete (global as { HTMLElement?: unknown }).HTMLElement;
    } else {
      (global as { HTMLElement?: unknown }).HTMLElement = originalHTMLElement;
    }
  }
};

describe('SearchResults', () => {
  const mockSpecies: SpeciesSummary[] = [
    {
      taxonId: 1,
      commonName: 'Species One',
      commonNames: ['Species One'],
      scientificName: 'Genus one',
      description: 'Description one',
    },
    {
      taxonId: 2,
      commonName: 'Species Two',
      commonNames: ['Species Two'],
      scientificName: 'Genus two',
      description: 'Description two',
    },
  ];

  beforeEach(() => {
    setPlatformOS('ios');
    mockUseColorScheme.mockReturnValue('dark');
  });

  afterEach(() => {
    restorePlatformOS();
  });

  it('uses the light palette path when color scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(<SearchResults results={mockSpecies} isVisible={true} />);

    expect(screen.getByText('Species One')).toBeTruthy();
  });

  it('keeps a hidden floating panel mounted with collapsed layout', () => {
    const { UNSAFE_getByProps } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={false}
        testID='search-results'
      />,
    );

    const hiddenList = UNSAFE_getByProps({ testID: 'search-results-list' });

    expect(hiddenList).toBeTruthy();
  });

  it('keeps inline native panel mounted while hidden', () => {
    const { queryByTestId, UNSAFE_getByProps } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={false}
        layout='inline'
        testID='search-results'
      />,
    );

    expect(UNSAFE_getByProps({ testID: 'search-results' })).toBeTruthy();
    expect(queryByTestId('search-results-list')).toBeNull();
  });

  it('keeps inline native panel mounted after rerendering from visible to hidden', () => {
    const { UNSAFE_getByProps, queryByTestId, rerender } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        layout='inline'
        testID='search-results'
      />,
    );

    expect(queryByTestId('search-results-list')).toBeTruthy();

    rerender(
      <SearchResults
        results={mockSpecies}
        isVisible={false}
        layout='inline'
        testID='search-results'
      />,
    );

    expect(UNSAFE_getByProps({ testID: 'search-results' })).toBeTruthy();
    expect(queryByTestId('search-results-list')).toBeNull();
  });

  it('keeps inline result slots mounted when the visible result count shrinks', () => {
    const { rerender, UNSAFE_getByProps } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        layout='inline'
        testID='search-results'
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'search-results-inline-result-slot-0' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'search-results-inline-result-slot-1' }),
    ).toBeTruthy();

    rerender(
      <SearchResults
        results={[mockSpecies[0]]}
        isVisible={true}
        layout='inline'
        testID='search-results'
      />,
    );

    expect(
      UNSAFE_getByProps({ testID: 'search-results-inline-result-slot-0' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'search-results-inline-result-slot-1' }),
    ).toBeTruthy();
    expect(
      UNSAFE_getByProps({ testID: 'search-results-inline-result-slot-1' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });

  it('renders results when isVisible is true', () => {
    render(<SearchResults results={mockSpecies} isVisible={true} />);

    expect(screen.getByText('Species One')).toBeTruthy();
    expect(screen.getByText('Species Two')).toBeTruthy();
  });

  it('renders loading SpeciesCard skeletons when isLoading is true', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID='search-results'
      />,
    );

    expect(screen.queryByText('Loading results...')).toBeNull();
    expect(screen.getAllByLabelText('Species card loading')).toHaveLength(5);
    expect(screen.queryByTestId('search-results-list')).toBeNull();
    expect(screen.getByTestId('search-results-loading')).toBeTruthy();
    expect(screen.queryByTestId('search-results-empty')).toBeNull();
  });

  it('omits loading testID when testID prop is not provided', () => {
    const { queryByTestId } = render(
      <SearchResults results={[]} isVisible={true} isLoading={true} />,
    );

    expect(queryByTestId('search-results-loading')).toBeNull();
  });

  it('displays empty message when no results and not loading', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={false}
        emptyMessage='No species found'
        testID='search-results'
      />,
    );

    expect(screen.getByText('No species found')).toBeTruthy();
    expect(screen.getByTestId('search-results-empty')).toBeTruthy();
    expect(screen.queryByTestId('search-results-loading')).toBeNull();
  });

  it('omits empty testID when testID prop is not provided', () => {
    const { queryByTestId } = render(
      <SearchResults results={[]} isVisible={true} isLoading={false} />,
    );

    expect(queryByTestId(/-empty$/)).toBeNull();
  });

  it('renders compact SpeciesCard for each result', () => {
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        testID='search-results'
      />,
    );

    expect(screen.getByTestId('search-result-1')).toBeTruthy();
    expect(screen.getByTestId('search-result-2')).toBeTruthy();
  });

  it('calls onSelectResult when a result is tapped', () => {
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    const handleSelect = jest.fn();
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;

    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        onSelectResult={handleSelect}
        testID='search-results'
      />,
    );

    const firstResultButton = screen.getByTestId('search-result-1');
    act(() => {
      fireEvent.press(firstResultButton);
    });

    expect(handleSelect).toHaveBeenCalledWith(mockSpecies[0]);

    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('renders with custom testID', () => {
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        testID='custom-search-results'
      />,
    );

    expect(screen.getByTestId('custom-search-results')).toBeTruthy();
  });

  it('respects maxHeight prop for list height constraint', () => {
    const { getByTestId } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        maxHeight={200}
        testID='search-results'
      />,
    );

    const container = getByTestId('search-results');
    const flattenedStyle = StyleSheet.flatten(container.props.style);

    expect(flattenedStyle?.maxHeight).toBe(200);
  });

  it('forwards pointer and touch handlers on the loading panel', () => {
    const onPointerEnter = jest.fn();
    const onPointerLeave = jest.fn();
    const onTouchStart = jest.fn();
    const onTouchEnd = jest.fn();

    const { getByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID='search-results'
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />,
    );

    const panel = getByTestId('search-results-loading');
    panel.props.onPointerEnter?.();
    panel.props.onPointerLeave?.();
    panel.props.onTouchStart?.();
    panel.props.onTouchEnd?.();

    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
    expect(onTouchStart).toHaveBeenCalledTimes(1);
    expect(onTouchEnd).toHaveBeenCalledTimes(1);
  });

  it('forwards focus and blur handlers on the loading panel', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    const { getByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID='search-results'
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const panel = getByTestId('search-results-loading');
    panel.props.onFocus?.();
    panel.props.onBlur?.();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('merges custom style overrides on the results panel', () => {
    const { getByTestId } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        testID='search-results'
        style={{ left: 12, right: 16, top: 24 }}
      />,
    );

    const panel = getByTestId('search-results');
    const flattenedStyle = StyleSheet.flatten(panel.props.style);

    expect(flattenedStyle?.left).toBe(12);
    expect(flattenedStyle?.right).toBe(16);
    expect(flattenedStyle?.top).toBe(24);
  });

  it('does not scroll when the active result is already visible', () => {
    expect(
      __SEARCH_RESULTS_TESTING__.getScrollOffsetForActiveResult(
        { y: 120, height: 56 },
        { height: 240, offset: 0 },
      ),
    ).toBeNull();
  });

  it('does not calculate a scroll offset without a measured result layout', () => {
    expect(
      __SEARCH_RESULTS_TESTING__.getScrollOffsetForActiveResult(undefined, {
        height: 240,
        offset: 0,
      }),
    ).toBeNull();
  });

  it('does not calculate a scroll offset when the viewport height is unknown', () => {
    expect(
      __SEARCH_RESULTS_TESTING__.getScrollOffsetForActiveResult(
        { y: 220, height: 56 },
        { height: 0, offset: 0 },
      ),
    ).toBeNull();
  });

  it('scrolls down when the active result is leaving the bottom edge', () => {
    expect(
      __SEARCH_RESULTS_TESTING__.getScrollOffsetForActiveResult(
        { y: 220, height: 56 },
        { height: 240, offset: 0 },
      ),
    ).toBe(52);
  });

  it('scrolls up when the active result is above the visible area', () => {
    expect(
      __SEARCH_RESULTS_TESTING__.getScrollOffsetForActiveResult(
        { y: 80, height: 56 },
        { height: 240, offset: 160 },
      ),
    ).toBe(64);
  });

  it('adds top padding when scrolling the active result back into view', () => {
    const scrollTo = jest.fn();

    const listRef = {
      current: {
        scrollTo,
      },
    } as unknown as React.RefObject<any>;

    __SEARCH_RESULTS_TESTING__.keepActiveResultVisible(
      listRef,
      { y: 80, height: 56 },
      { height: 240, offset: 160 },
    );

    expect(scrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 64,
    });
  });

  it('keeps the active result visible through the list ref when needed', () => {
    const listRef = {
      current: {
        scrollTo: jest.fn(),
      },
    } as unknown as React.RefObject<any>;

    __SEARCH_RESULTS_TESTING__.keepActiveResultVisible(
      listRef,
      { y: 220, height: 56 },
      { height: 240, offset: 0 },
    );

    expect(listRef.current.scrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 52,
    });
  });

  it('does not scroll when the active result remains inside the visible window', () => {
    const scrollTo = jest.fn();

    const listRef = {
      current: {
        scrollTo,
      },
    } as unknown as React.RefObject<any>;

    __SEARCH_RESULTS_TESTING__.keepActiveResultVisible(
      listRef,
      { y: 120, height: 56 },
      { height: 240, offset: 0 },
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the active web result visible via instance-scoped DOM ids', () => {
    const listId =
      __SEARCH_RESULTS_TESTING__.getSearchResultsListElementId('instance-1');
    const resultId = __SEARCH_RESULTS_TESTING__.getSearchResultsResultElementId(
      'instance-1',
      3,
    );

    class MockHTMLElement {
      id = '';
      scrollTop = 0;
      getBoundingClientRect = () =>
        ({
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    const listElement = new MockHTMLElement();
    const resultElement = new MockHTMLElement();

    listElement.id = listId;
    resultElement.id = resultId;
    listElement.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 340,
        left: 0,
        right: 0,
        width: 0,
        height: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    resultElement.getBoundingClientRect = () =>
      ({
        top: 320,
        bottom: 392,
        left: 0,
        right: 0,
        width: 0,
        height: 72,
        x: 0,
        y: 320,
        toJSON: () => ({}),
      }) as DOMRect;

    withMockDomGlobals(
      MockHTMLElement,
      (id: string) => {
        if (id === listId) {
          return listElement;
        }

        if (id === resultId) {
          return resultElement;
        }

        return null;
      },
      () => {
        __SEARCH_RESULTS_TESTING__.keepActiveWebResultVisible(listId, resultId);

        expect(listElement.scrollTop).toBe(68);
      },
    );
  });

  it('returns early when the active web result ids are missing', () => {
    expect(() => {
      __SEARCH_RESULTS_TESTING__.keepActiveWebResultVisible(
        undefined,
        undefined,
      );
    }).not.toThrow();
  });

  it('returns early when the active web result elements cannot be resolved', () => {
    class MockHTMLElement {
      getBoundingClientRect = () =>
        ({
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    withMockDomGlobals(
      MockHTMLElement,
      () => null,
      () => {
        expect(() => {
          __SEARCH_RESULTS_TESTING__.keepActiveWebResultVisible(
            'missing-list',
            'missing-result',
          );
        }).not.toThrow();
      },
    );
  });

  it('applies the active highlight in inline layout when the index matches', () => {
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        layout='inline'
        activeResultIndex={1}
        testID='search-results'
      />,
    );

    const activeCard = screen.getByTestId('search-result-2');
    const inactiveCard = screen.getByTestId('search-result-1');
    const activeStyle = StyleSheet.flatten(activeCard.props.style);
    const inactiveStyle = StyleSheet.flatten(inactiveCard.props.style);

    expect(activeStyle?.backgroundColor).toBeTruthy();
    expect(activeStyle?.backgroundColor).not.toBe(
      inactiveStyle?.backgroundColor,
    );
  });
});
