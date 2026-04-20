import { Colors, Typography } from '@/constants/theme';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import {
  create,
  type ReactTestRendererJSON,
  type ReactTestRendererNode,
} from 'react-test-renderer';
import {
  Platform,
  PressableStateCallbackType,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../SpeciesCard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTypographyStyles } from '@/hooks/useTypographyStyles';
import { useRouter } from 'expo-router';
import type { Router } from 'expo-router';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/useTypographyStyles', () => ({
  useTypographyStyles: jest.fn(),
}));

jest.mock('@/components/text/ThemedText', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    ThemedText: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactActual.createElement(Text, props, children),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseTypographyStyles = useTypographyStyles as jest.MockedFunction<
  typeof useTypographyStyles
>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;
const globalScope = global as typeof globalThis & {
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
  window?: {
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
};
const originalWindow = globalScope.window;
const originalGlobalAddEventListener = globalScope.addEventListener;
const originalGlobalRemoveEventListener = globalScope.removeEventListener;
const originalWindowAddEventListener = globalScope.window?.addEventListener;
const originalWindowRemoveEventListener =
  globalScope.window?.removeEventListener;

let pushMock: jest.Mock;
let routerStub: Router;

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

const installWindowEventListenerMocks = () => {
  const nextWindow = globalScope.window ?? {};

  globalScope.addEventListener = jest.fn();
  globalScope.removeEventListener = jest.fn();
  nextWindow.addEventListener = jest.fn();
  nextWindow.removeEventListener = jest.fn();
  globalScope.window = nextWindow;
};

const restoreWindowEventListenerMocks = () => {
  if (!globalScope.window) {
    return;
  }

  if (originalGlobalAddEventListener) {
    globalScope.addEventListener = originalGlobalAddEventListener;
  } else {
    Reflect.deleteProperty(globalScope, 'addEventListener');
  }

  if (originalGlobalRemoveEventListener) {
    globalScope.removeEventListener = originalGlobalRemoveEventListener;
  } else {
    Reflect.deleteProperty(globalScope, 'removeEventListener');
  }

  if (originalWindowAddEventListener) {
    globalScope.window.addEventListener = originalWindowAddEventListener;
  } else {
    Reflect.deleteProperty(globalScope.window, 'addEventListener');
  }

  if (originalWindowRemoveEventListener) {
    globalScope.window.removeEventListener = originalWindowRemoveEventListener;
  } else {
    Reflect.deleteProperty(globalScope.window, 'removeEventListener');
  }

  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalScope, 'window');
  } else {
    globalScope.window = originalWindow;
  }
};

const createRouterStub = (overrides: Partial<Router> = {}): Router => ({
  back: jest.fn() as Router['back'],
  canGoBack: jest.fn(() => false) as Router['canGoBack'],
  push: jest.fn() as Router['push'],
  navigate: jest.fn() as Router['navigate'],
  replace: jest.fn() as Router['replace'],
  dismiss: jest.fn() as Router['dismiss'],
  dismissAll: jest.fn() as Router['dismissAll'],
  dismissTo: jest.fn() as Router['dismissTo'],
  canDismiss: jest.fn(() => false) as Router['canDismiss'],
  setParams: jest.fn() as Router['setParams'],
  reload: jest.fn() as Router['reload'],
  prefetch: jest.fn() as Router['prefetch'],
  ...overrides,
});

type HoverAwarePressableState = PressableStateCallbackType & {
  hovered?: boolean;
};
const createPressableState = (
  state: Partial<HoverAwarePressableState> = {},
): HoverAwarePressableState => ({
  pressed: state.pressed ?? false,
  hovered: state.hovered ?? false,
});
const getFlattenedStyleByTestId = (testId: string) =>
  StyleSheet.flatten(screen.getByTestId(testId).props.style);

describe('SpeciesCard', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
    mockUseTypographyStyles.mockReturnValue(Typography.dark);
    pushMock = jest.fn();
    routerStub = createRouterStub({ push: pushMock as Router['push'] });
    mockUseRouter.mockReturnValue(routerStub);
    restorePlatformOS();
    installWindowEventListenerMocks();
  });

  afterEach(() => {
    restorePlatformOS();
    restoreWindowEventListenerMocks();
  });

  const baseProps = {
    taxonId: 555,
    commonName: 'Common Name',
    scientificName: 'Binomial nomenclature',
    description: 'Description',
  };

  it('renders placeholder when no image is provided', () => {
    render(<SpeciesCard {...baseProps} />);

    expect(screen.getByTestId('species-card-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('species-card-image')).toBeNull();
  });

  it('renders provided image source', () => {
    render(
      <SpeciesCard
        {...baseProps}
        imageSource={{ uri: 'https://example.com/species.png' }}
      />,
    );

    expect(screen.getByTestId('species-card-image')).toBeTruthy();
    expect(screen.queryByTestId('species-card-placeholder')).toBeNull();
  });

  it('renders loading skeleton bars instead of placeholder text', () => {
    render(<SpeciesCard {...baseProps} loading testID='species-card-root' />);

    expect(screen.getByTestId('species-card-root')).toBeTruthy();
    expect(screen.getByTestId('species-card-loading')).toBeTruthy();
    expect(screen.getByTestId('species-card-loading-title')).toBeTruthy();
    expect(screen.getByTestId('species-card-loading-subtitle')).toBeTruthy();
    expect(
      screen.getByTestId('species-card-loading-description-1'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('species-card-loading-description-2'),
    ).toBeTruthy();
    expect(screen.queryByText(baseProps.commonName)).toBeNull();
    expect(screen.queryByText(baseProps.scientificName)).toBeNull();
    expect(screen.queryByText(baseProps.description)).toBeNull();
  });

  it('matches loading bar heights to the card typography font sizes', () => {
    render(<SpeciesCard {...baseProps} loading />);

    expect(getFlattenedStyleByTestId('species-card-loading-title').height).toBe(
      Typography.dark.subheading.fontSize,
    );
    expect(
      getFlattenedStyleByTestId('species-card-loading-subtitle').height,
    ).toBe(Typography.dark.bodySmallEmphasis.fontSize);
    expect(
      getFlattenedStyleByTestId('species-card-loading-description-1').height,
    ).toBe(Typography.dark.body.fontSize);
    expect(
      getFlattenedStyleByTestId('species-card-loading-description-2').height,
    ).toBe(Typography.dark.body.fontSize);
  });

  it('uses stable varied loading bar widths based on the provided seed', () => {
    const seeded = render(
      <SpeciesCard {...baseProps} loading loadingPatternSeed={1} />,
    );
    const seededTitleWidth = getFlattenedStyleByTestId(
      'species-card-loading-title',
    ).width;
    const seededSubtitleWidth = getFlattenedStyleByTestId(
      'species-card-loading-subtitle',
    ).width;

    seeded.unmount();

    render(<SpeciesCard {...baseProps} loading loadingPatternSeed={2} />);

    expect(seededTitleWidth).toBe(
      __SPECIES_CARD_TESTING__.resolveLoadingWidthPattern(1).title,
    );
    expect(seededSubtitleWidth).toBe(
      __SPECIES_CARD_TESTING__.resolveLoadingWidthPattern(1).subtitle,
    );
    expect(getFlattenedStyleByTestId('species-card-loading-title').width).toBe(
      __SPECIES_CARD_TESTING__.resolveLoadingWidthPattern(2).title,
    );
    expect(seededTitleWidth).not.toBe(
      __SPECIES_CARD_TESTING__.resolveLoadingWidthPattern(2).title,
    );
  });

  it('fires the onPress callback when tapped', () => {
    const handlePress = jest.fn();
    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        testID='species-card'
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('fires a custom onPress even when route data is invalid', () => {
    const handlePress = jest.fn();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <SpeciesCard
        {...baseProps}
        taxonId={undefined as unknown as number}
        scientificName=''
        onPress={handlePress}
        testID='species-card'
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('preserves route href props on web when a custom onPress is provided in route mode', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        testID='species-card'
      />,
    );

    const card = screen.getByTestId('species-card');

    expect(card.props.href).toBe('/species/555/binomial-nomenclature');
  });

  it('does not expose route href props in press-only mode', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        interactionMode='press-only'
        testID='species-card'
      />,
    );

    const card = screen.getByTestId('species-card');

    expect(card.props.href).toBeUndefined();
  });

  it('maps hover and pressed states to the secondary palette by default', () => {
    const palette = Colors.light;
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({
          pressed: true,
        }),
      ),
    ).toBe(palette.background.default.secondaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({
          hovered: true,
        }),
      ),
    ).toBe(palette.background.default.secondaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({}),
      ),
    ).toBe(palette.background.default.secondary);
  });

  it('can render the tertiary palette via variant', () => {
    const palette = Colors.light;
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({ pressed: true }),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({ hovered: true }),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({}),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiary);
  });

  it('applies light mode placeholder background when scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(<SpeciesCard {...baseProps} />);

    const placeholder = screen.getByTestId('species-card-placeholder');
    const placeholderStyles = StyleSheet.flatten(placeholder.props.style);
    expect(placeholderStyles.backgroundColor).toBe(
      Colors.light.background.disabled.default,
    );
  });

  it('navigates using the provided identifiers when pressed', () => {
    render(<SpeciesCard {...baseProps} testID='species-card' />);

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['555', 'binomial-nomenclature'] },
    });
  });

  it('trims whitespace before slugifying the scientific name', () => {
    render(
      <SpeciesCard
        {...baseProps}
        scientificName='  Strix nebulosa  '
        testID='species-card'
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['555', 'strix-nebulosa'] },
    });
  });

  it('renders a real href for species details on web', () => {
    setPlatformOS('web');

    render(<SpeciesCard {...baseProps} testID='species-card' />);

    expect(screen.getByTestId('species-card').props.href).toBe(
      '/species/555/binomial-nomenclature',
    );
  });

  it('keeps a single stable content wrapper inside the pressable for Fabric stability', () => {
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<SpeciesCard {...baseProps} testID='species-card' />);
    });

    if (!renderer) {
      throw new Error('Renderer was not created.');
    }

    const stableRenderer = renderer;
    const renderedTree = stableRenderer.toJSON();

    type RenderedNode = ReactTestRendererJSON & {
      props: ReactTestRendererJSON['props'] & {
        collapsable?: boolean;
        style?: unknown;
      };
    };

    const collectNodes = (
      node: ReactTestRendererJSON | ReactTestRendererJSON[] | null,
    ): RenderedNode[] => {
      if (!node) {
        return [];
      }

      if (Array.isArray(node)) {
        return node.flatMap((child) => collectNodes(child));
      }

      return [
        node as RenderedNode,
        ...(node.children ?? []).flatMap((child: ReactTestRendererNode) =>
          typeof child === 'string' ? [] : collectNodes(child),
        ),
      ];
    };

    const stableWrapperNodes = collectNodes(renderedTree).filter((node) => {
      const flattenedStyle = StyleSheet.flatten(node.props?.style) as
        | ViewStyle
        | undefined;
      const objectChildren = (node.children ?? []).filter(
        (child): child is ReactTestRendererJSON => typeof child !== 'string',
      );

      return (
        node.props?.collapsable === false &&
        flattenedStyle?.flexDirection === 'row' &&
        flattenedStyle?.width === '100%' &&
        flattenedStyle?.padding === undefined &&
        flattenedStyle?.paddingHorizontal === undefined &&
        objectChildren.length === 2
      );
    });

    expect(stableWrapperNodes).toHaveLength(1);
    expect(stableWrapperNodes[0]?.props?.collapsable).toBe(false);

    act(() => {
      stableRenderer.unmount();
    });
  });

  it('lets ctrl/cmd click fall back to the browser on web', () => {
    setPlatformOS('web');
    render(<SpeciesCard {...baseProps} testID='species-card' />);

    fireEvent(screen.getByTestId('species-card'), 'press', {
      nativeEvent: { ctrlKey: true },
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not call custom onPress before browser-handled modifier clicks on web in route mode', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();
    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        testID='species-card'
      />,
    );

    fireEvent(screen.getByTestId('species-card'), 'press', {
      nativeEvent: { metaKey: true },
    });

    expect(handlePress).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('still calls custom onPress on web modifier clicks in press-only mode', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();
    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        interactionMode='press-only'
        testID='species-card'
      />,
    );

    fireEvent(screen.getByTestId('species-card'), 'press', {
      nativeEvent: { metaKey: true },
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not intercept shift click on web', () => {
    setPlatformOS('web');
    render(<SpeciesCard {...baseProps} testID='species-card' />);

    fireEvent(screen.getByTestId('species-card'), 'press', {
      nativeEvent: { shiftKey: true },
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does nothing when no identifier is available', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(jest.fn());
    render(
      <SpeciesCard
        {...baseProps}
        taxonId={undefined as unknown as number}
        commonName=''
        scientificName=''
        testID='species-card'
      />,
    );

    expect(screen.getByTestId('species-card')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'SpeciesCard requires a taxonId to navigate',
    );
    consoleErrorSpy.mockRestore();
  });

  it('logs when the provided scientific name is missing', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <SpeciesCard {...baseProps} scientificName='' testID='species-card' />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'SpeciesCard requires a scientific name to navigate',
    );
    consoleErrorSpy.mockRestore();
  });

  it('logs when the scientific name cannot be converted to a slug', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <SpeciesCard
        {...baseProps}
        scientificName={'!!!'}
        testID='species-card'
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'SpeciesCard: scientific name could not be converted to a valid URL segment',
    );
    consoleErrorSpy.mockRestore();
  });

  it('does not navigate after calling a custom onPress', () => {
    const handlePress = jest.fn();
    render(
      <SpeciesCard
        {...baseProps}
        onPress={handlePress}
        testID='species-card'
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not display a description when compact, and displays it by default', () => {
    render(<SpeciesCard {...baseProps} size='compact' testID='species-card' />);

    expect(screen.queryByTestId('species-card-description')).toBeNull();

    render(<SpeciesCard {...baseProps} testID='species-card' />);

    expect(screen.getByTestId('species-card-description')).toBeTruthy();
  });
});
