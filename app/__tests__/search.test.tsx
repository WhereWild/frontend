import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { render, screen } from '@testing-library/react-native';
import React, { act } from 'react';
import { StyleSheet } from 'react-native';
import Search from '../search';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/search',
    useLocalSearchParams: () => ({ query: '' }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
    useColorScheme: jest.fn(() => 'dark'),
}));

let webPageHeaderProps: any;

jest.mock('@/components', () => {
    const { SpeciesCard } = jest.requireActual('@/components/cards/SpeciesCard');
    const { ThemedText } = jest.requireActual('@/components/text/ThemedText');

    return {
        WebPageHeader: function MockWebPageHeader(props: any) {
            webPageHeaderProps = props;
            return null;
        },
        SpeciesCard,
        ThemedText,
    };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
    typeof useColorScheme
>;

const mockSpeciesResults = [
    {
        taxonId: 1, 
        commonName: 'Test Species 1',
        scientificName: 'Testus speciesone',
        imageSource: { uri: 'test1' },
    },
    {
        taxonId: 2, 
        commonName: 'Test Species 2',
        scientificName: 'Testus speciestwo',
        imageSource: { uri: 'test2' },
    },
];

describe('Search screen', () => {
    beforeEach(() => {
        mockUseColorScheme.mockReturnValue('dark');
        mockPush.mockClear();
    });

    it('captures page header props', () => {
        render(<Search />);
        expect(webPageHeaderProps).toBeDefined();
    });

    it('displays the Results heading', () => {
        render(<Search />);
        expect(screen.getByText('Results')).toBeTruthy();
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

        act(() => {
                webPageHeaderProps.onSearchingChanged(true);
        });
        
        expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('shows empty state message when no results', () => {
        render(<Search />);
        act(() => {
                webPageHeaderProps.onSearchResultsChanged([]);
                webPageHeaderProps.onSearchingChanged(false);
        });
            
        expect(screen.getByText('Enter a search term to see results.')).toBeTruthy();
    });

    it('updates species card list when search results change', () => {
        render(<Search />);
        act(() => {
                webPageHeaderProps.onSearchResultsChanged(mockSpeciesResults);
                webPageHeaderProps.onSearchingChanged(false);
        });
            
        expect(screen.queryByText('Enter a search term to see results.')).toBeNull();
        expect(screen.getByText('Test Species 1')).toBeTruthy();
        expect(screen.getByText('Test Species 2')).toBeTruthy();
    });
});
