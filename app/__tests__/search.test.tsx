import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { act } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Search from '../search';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({ query: '' }));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/search',
    useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
    useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: jest.fn(() => ({
        breakpoint: 'desktop',
        contentWidth: 1200,
        gap: 32,
        marginHorizontal: 32,
    })),
}));

const mockFilterParams = {
    locationGid: null,
    ancestorTaxonId: null,
    rank: 'species',
    includeSubspecies: true,
    sortVariable: null,
    sortMetric: null,
    sortOrder: 'asc' as const,
    minimumSamples: 10,
    numberOfResults: 10,
};

const mockSetHeaderConfig = jest.fn();
const mockResetHeaderConfig = jest.fn();
const mockSetNativeTopAppBarConfig = jest.fn();
const mockResetNativeTopAppBarConfig = jest.fn();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
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

const mockFiltersResult = {
    countryValue: '',
    countryOptions: [],
    countryLoading: false,
    onCountryChange: jest.fn(),
    stateValue: '',
    stateOptions: [],
    stateLoading: false,
    onStateChange: jest.fn(),
    countyValue: '',
    countyOptions: [],
    countyLoading: false,
    onCountyChange: jest.fn(),
    baseTaxonQuery: '',
    onBaseTaxonQueryChange: jest.fn(),
    onBaseTaxonSubmit: jest.fn(),
    onBaseTaxonFocus: jest.fn(),
    onBaseTaxonBlur: jest.fn(),
    rankValue: 'species',
    rankOptions: [{ label: 'Species', value: 'species' }],
    onRankChange: jest.fn(),
    includeSubspecies: true,
    onIncludeSubspeciesChange: jest.fn(),
    sortVariableValue: '',
    sortVariableOptions: [],
    sortVariableLoading: false,
    onSortVariableChange: jest.fn(),
    sortMetricValue: 'mean',
    sortMetricOptions: [{ label: 'Average', value: 'mean' }],
    onSortMetricChange: jest.fn(),
    sortOrder: 'ascending' as const,
    onSortOrderChange: jest.fn(),
    numberOfResults: 10,
    onNumberOfResultsChange: jest.fn(),
    minimumSamples: 10,
    onMinimumSamplesChange: jest.fn(),
    onResetFilters: jest.fn(),
    filterParams: mockFilterParams,
    hasActiveFilters: false,
};

jest.mock('@/hooks/useSearchFilters', () => ({
    useSearchFilters: jest.fn(() => mockFiltersResult),
}));

jest.mock('@/context/WebPageHeaderContext', () => ({
    useWebPageHeaderConfig: () => ({
        setConfig: mockSetHeaderConfig,
        resetConfig: mockResetHeaderConfig,
    }),
}));

jest.mock('@/context/NativeTopAppBarContext', () => ({
    useNativeTopAppBarConfig: () => ({
        setConfig: mockSetNativeTopAppBarConfig,
        resetConfig: mockResetNativeTopAppBarConfig,
    }),
}));

let mockFiltersProps: any;
let mockSpeciesCardPropsHistory: any[];

jest.mock('@/components', () => {
    const { SpeciesCard: ActualSpeciesCard } = jest.requireActual('@/components/cards/SpeciesCard');
    const { ThemedText } = jest.requireActual('@/components/text/ThemedText');

    return {
        SpeciesCard: function MockSpeciesCard(props: any) {
            mockSpeciesCardPropsHistory.push(props);
            return <ActualSpeciesCard {...props} />;
        },
        ThemedText,
        Filters: function MockFilters(props: any) {
            mockFiltersProps = props;
            return null;
        },
    };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
    typeof useColorScheme
>;
const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;

const getLatestHeaderConfig = () => {
    const latestCall = mockSetHeaderConfig.mock.calls[mockSetHeaderConfig.mock.calls.length - 1];
    if (!latestCall) {
        throw new Error('Expected Search to configure WebPageHeader');
    }
    return latestCall[0];
};

const mockSpeciesResults = [
    {
        taxonId: 1, 
        commonName: 'Test Species 1',
        scientificName: 'Testus speciesone',
        description: '12.5 | Rank 1 of 10 | Percentile 95%',
        imageSource: { uri: 'test1' },
    },
    {
        taxonId: 2, 
        commonName: 'Test Species 2',
        scientificName: 'Testus speciestwo',
        description: '8.25 | Rank 2 of 10 | Percentile 90%',
        imageSource: { uri: 'test2' },
    },
];

describe('Search screen', () => {
    beforeEach(() => {
        setPlatformOS('ios');
        mockUseLocalSearchParams.mockReturnValue({ query: '' });
        mockUseColorScheme.mockReturnValue('dark');
        mockUseResponsive.mockReturnValue({
            breakpoint: 'desktop',
            contentWidth: 1200,
            gap: 32,
            marginHorizontal: 32,
        } as any);
        mockPush.mockClear();
        mockSetHeaderConfig.mockClear();
        mockResetHeaderConfig.mockClear();
        mockSetNativeTopAppBarConfig.mockClear();
        mockResetNativeTopAppBarConfig.mockClear();
        mockFiltersProps = undefined;
        mockSpeciesCardPropsHistory = [];
        mockFiltersResult.hasActiveFilters = false;
        mockFiltersResult.onResetFilters.mockClear();
    });

    afterEach(() => {
        restorePlatformOS();
    });

    it('configures shared header props', () => {
        render(<Search />);
        expect(mockSetHeaderConfig).toHaveBeenCalled();
    });

    it('displays the Results heading', () => {
        render(<Search />);
        expect(screen.getByText('Results')).toBeTruthy();
    });

    it('configures native top app bar through shared layout context on native', () => {
        setPlatformOS('ios');
        render(<Search />);

        expect(mockSetNativeTopAppBarConfig).toHaveBeenCalled();
        expect(getLatestHeaderConfig().showFilterButton).toBe(true);
    });

    it('does not configure native top app bar context on web', () => {
        setPlatformOS('web');
        render(<Search />);

        expect(mockSetNativeTopAppBarConfig).not.toHaveBeenCalled();
    });

    it('applies dark mode background color by default', () => {
        mockUseColorScheme.mockReturnValue('dark');
        const tree = render(<Search />).toJSON();

        if (!tree || Array.isArray(tree)) {
        throw new Error('Expected Search to render a single root view');
        }

        const styles = StyleSheet.flatten(tree.props.style);
        expect(styles.backgroundColor).toBe(Colors.dark.background.default.default);
    });

    it('applies light mode background color when overridden', () => {
        mockUseColorScheme.mockReturnValue('light');
        const tree = render(<Search />).toJSON();

        if (!tree || Array.isArray(tree)) {
            throw new Error('Expected Search to render a single root view');
        }

        const styles = StyleSheet.flatten(tree.props.style);
        expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
    });

    it('shows loading state message while searching', () => {
        render(<Search />);
        const headerConfig = getLatestHeaderConfig();

        act(() => {
            headerConfig.onSearchingChanged(true);
        });
        
        expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('shows empty state message when no results', () => {
        render(<Search />);
        const headerConfig = getLatestHeaderConfig();
        act(() => {
            headerConfig.onSearchResultsChanged([]);
            headerConfig.onSearchingChanged(false);
        });
            
        expect(screen.getByText('Enter a search term to see results.')).toBeTruthy();
    });

    it('shows fallback explanation when ranking search falls back to text search', () => {
        render(<Search />);
        const headerConfig = getLatestHeaderConfig();

        act(() => {
            headerConfig.onSearchContextChanged(
                'No ranked matches found for "spinystar". Showing text-search fallback results, which may include broader matches than the selected base taxon.',
            );
        });

        expect(
            screen.getByText(
                'No ranked matches found for "spinystar". Showing text-search fallback results, which may include broader matches than the selected base taxon.',
            ),
        ).toBeTruthy();
    });

    it('shows query failure context message when search fails', () => {
        render(<Search />);
        const headerConfig = getLatestHeaderConfig();

        act(() => {
            headerConfig.onSearchContextChanged('Search failed. Please try again.');
        });

        expect(screen.getByText('Search failed. Please try again.')).toBeTruthy();
    });

    it('updates species card list when search results change', () => {
        render(<Search />);
        const headerConfig = getLatestHeaderConfig();
        act(() => {
            headerConfig.onSearchResultsChanged(mockSpeciesResults);
            headerConfig.onSearchingChanged(false);
        });
            
        expect(screen.queryByText('Enter a search term to see results.')).toBeNull();
        expect(screen.getByText('Test Species 1')).toBeTruthy();
        expect(screen.getByText('Test Species 2')).toBeTruthy();
        expect(screen.getByText('12.5 | Rank 1 of 10 | Percentile 95%')).toBeTruthy();
    });

    it('uses compact species cards on phone displays', () => {
        mockUseResponsive.mockReturnValue({
            breakpoint: 'phone',
            contentWidth: 360,
            gap: 16,
            marginHorizontal: 16,
        } as any);

        render(<Search />);
        const headerConfig = getLatestHeaderConfig();
        act(() => {
            headerConfig.onSearchResultsChanged(mockSpeciesResults);
            headerConfig.onSearchingChanged(false);
        });

        const renderedCardProps = mockSpeciesCardPropsHistory.filter((props) => props.taxonId != null);
        expect(renderedCardProps.length).toBeGreaterThan(0);
        renderedCardProps.forEach((props) => {
            expect(props.size).toBe('compact');
        });
    });

    describe('filter panel', () => {
        it('passes filterParams from useSearchFilters to WebPageHeader', () => {
            render(<Search />);
            expect(getLatestHeaderConfig().filterParams).toEqual(mockFilterParams);
        });

        it('shows the WebPageHeader filter button', () => {
            render(<Search />);
            expect(getLatestHeaderConfig().showFilterButton).toBe(true);
        });

        it('hides the filters panel by default', () => {
            render(<Search />);
            expect(mockFiltersProps).toBeUndefined();
        });

        it('shows the filters panel when header filter button is pressed once', () => {
            render(<Search />);
            const headerConfig = getLatestHeaderConfig();
            mockFiltersProps = undefined;
            act(() => {
                headerConfig.onFilterPress();
            });
            expect(mockFiltersProps).toBeDefined();
        });

        it('hides the filters panel again on a second header filter button press', () => {
            render(<Search />);
            const headerConfig = getLatestHeaderConfig();
            mockFiltersProps = undefined;
            act(() => {
                headerConfig.onFilterPress();
            });
            expect(mockFiltersProps).toBeDefined();
            expect(getLatestHeaderConfig().filterLabel).toBe('Hide Filter');

            act(() => {
                headerConfig.onFilterPress();
            });
            expect(getLatestHeaderConfig().filterLabel).toBe('Filter');
        });

        it('hides reset handler in WebPageHeader when no filter is active', () => {
            render(<Search />);
            expect(getLatestHeaderConfig().showResetFilterButton).toBe(false);
        });

        it('shows reset handler in WebPageHeader when a filter is active', () => {
            mockFiltersResult.hasActiveFilters = true;
            render(<Search />);
            const headerConfig = getLatestHeaderConfig();
            expect(headerConfig.showResetFilterButton).toBe(true);
            act(() => {
                headerConfig.onResetFilterPress();
            });
            expect(mockFiltersResult.onResetFilters).toHaveBeenCalledTimes(1);
        });

        it('passes filter callbacks to the Filters panel', () => {
            render(<Search />);
            const headerConfig = getLatestHeaderConfig();
            act(() => {
                headerConfig.onFilterPress();
            });
            expect(typeof mockFiltersProps.onCountryChange).toBe('function');
            expect(typeof mockFiltersProps.onResetFilters).toBe('function');
        });

        it('passes undefined initial query when route query is missing', () => {
            mockUseLocalSearchParams.mockReturnValue({ query: undefined as any });

            render(<Search />);

            expect(getLatestHeaderConfig().initialQuery).toBeUndefined();
        });

        it('updates layout width from layout events', () => {
            const rendered = render(<Search />);
            const layoutView = rendered.UNSAFE_getAllByType(View).find(
                (viewNode) => typeof viewNode.props.onLayout === 'function',
            );

            expect(layoutView).toBeDefined();

            act(() => {
                fireEvent(layoutView!, 'layout', {
                    nativeEvent: { layout: { width: 420 } },
                });
            });
        });

        it('handles hide animation completion callbacks', () => {
            const startMock = jest.fn((callback?: (result: { finished: boolean }) => void) => {
                callback?.({ finished: true });
            });
            const stopMock = jest.fn();
            const parallelSpy = jest
                .spyOn(Animated, 'parallel')
                .mockReturnValue({ start: startMock, stop: stopMock } as any);

            render(<Search />);
            const headerConfig = getLatestHeaderConfig();

            act(() => {
                headerConfig.onFilterPress();
            });

            act(() => {
                headerConfig.onFilterPress();
            });

            expect(startMock).toHaveBeenCalled();
            parallelSpy.mockRestore();
        });

        it('uses stacked filter slide offsets when layout cannot fit side-by-side columns', () => {
            const setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');
            const rendered = render(<Search />);
            const layoutView = rendered.UNSAFE_getAllByType(View).find(
                (viewNode) => typeof viewNode.props.onLayout === 'function',
            );

            act(() => {
                fireEvent(layoutView!, 'layout', {
                    nativeEvent: { layout: { width: 420 } },
                });
            });

            const headerConfig = getLatestHeaderConfig();
            act(() => {
                headerConfig.onFilterPress();
            });

            expect(setValueSpy).toHaveBeenCalledWith(-480);
            setValueSpy.mockRestore();
        });
    });
});
