import { IconFilter, IconRotateCcw } from '@/assets/icons';
import {
  ActiveNearYouSection,
  HomeRecommendationFilter,
  LocalMapSection,
  PageScrollContainer,
  PageTitle,
  WeatherAttribution,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import {
  getResponsiveContentContainerStyle,
  getResponsiveGapStyle,
} from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import type { HomePageData } from '@/data/types';
import { useHomeDashboardState } from '@/hooks/useHomeDashboardState';
import { useResponsive } from '@/hooks/useResponsive';
import { Asset } from 'expo-asset';
import {
  getHomeHistoryState,
  getStoredHomeActiveGroup,
  getStoredHomeFilterVisibility,
  hasHomeHistoryActiveGroup,
  hasHomeHistoryFilterVisibility,
  mergeHomeHistoryState,
  setStoredHomeActiveGroup,
  setStoredHomeFilterVisibility,
} from '../../hooks/home/homeRouteState';
import React from 'react';
import { resolveOpenGraphImageUrl, WebMetadata } from '@/utils/webMetadata';
import { StyleSheet, View } from 'react-native';

const SIDEBAR_WIDTH = 400;
const HOME_LOGO_IMAGE = require('@/assets/images/wherewild.png');

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    if (!('sessionStorage' in window)) {
      return null;
    }

    return window.sessionStorage;
  } catch {
    // Accessing sessionStorage can throw in restricted browser contexts; fall
    // back to history/default state instead of breaking initial render.
    return null;
  }
};

const getInitialWebHomeUiState = () => {
  if (typeof window === 'undefined') {
    return {
      activeGroup: 'all',
      filterVisible: false,
    };
  }

  const historyState = window.history.state;
  const homeHistoryState = getHomeHistoryState(historyState);
  const activeGroup = hasHomeHistoryActiveGroup(historyState)
    ? homeHistoryState.activeGroup
    : getStoredHomeActiveGroup(getSessionStorage());
  const filterVisible = hasHomeHistoryFilterVisibility(historyState)
    ? homeHistoryState.filterVisible
    : getStoredHomeFilterVisibility(getSessionStorage());

  return {
    activeGroup,
    filterVisible,
  };
};

export function WebHomeDashboard({ data }: { data?: HomePageData }) {
  const responsive = useResponsive();
  const isPhoneBreakpoint = responsive.breakpoint === 'phone';
  const homeImageUrl = React.useMemo(
    () =>
      resolveOpenGraphImageUrl({
        uri: Asset.fromModule(HOME_LOGO_IMAGE).uri,
      }),
    [],
  );
  const initialUiStateRef = React.useRef(getInitialWebHomeUiState());
  const {
    activeGroup,
    allScored,
    handleBoundsChange,
    hasActiveFilter,
    heatmapTileUrl,
    recommendations,
    scoresLoading,
    setActiveGroup,
  } = useHomeDashboardState(data, {
    initialActiveGroup: initialUiStateRef.current.activeGroup,
  });
  const [isFilterVisible, setIsFilterVisible] = React.useState(
    () =>
      initialUiStateRef.current.filterVisible ||
      initialUiStateRef.current.activeGroup !== 'all',
  );

  React.useEffect(() => {
    if (hasActiveFilter) {
      setIsFilterVisible(true);
    }
  }, [hasActiveFilter]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) {
      return;
    }

    setStoredHomeFilterVisibility(getSessionStorage(), isFilterVisible);
    setStoredHomeActiveGroup(getSessionStorage(), activeGroup);
    window.history.replaceState(
      mergeHomeHistoryState(window.history.state, {
        filterVisible: isFilterVisible,
        activeGroup,
      }),
      '',
      window.location.href,
    );
  }, [activeGroup, isFilterVisible]);

  React.useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return;
    }

    const handlePopState = () => {
      const nextUiState = getInitialWebHomeUiState();
      setIsFilterVisible(
        nextUiState.filterVisible || nextUiState.activeGroup !== 'all',
      );
      setActiveGroup(nextUiState.activeGroup);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setActiveGroup]);

  return (
    <>
      <WebMetadata
        title='WhereWild | Home'
        description='WhereWild is a website and mobile application that combines occurrence and environmental data to generate a field guide and in-depth analytics on the habitat of over 400,000 species.'
        imageUrl={homeImageUrl}
        path='/'
      />
      <PageSurface>
        <View style={styles.screenWeb}>
          <PageScrollContainer
            contentContainerStyle={getResponsiveContentContainerStyle(
              responsive,
              {
                includeHorizontalPadding: false,
              },
            )}
            bounces={false}
          >
            <PageTitle
              title='Home'
              constrainContentWidth={false}
              iconButton={
                hasActiveFilter
                  ? {
                      variant: 'neutral',
                      enableHaptics: true,
                      icon: <IconRotateCcw />,
                      accessibilityLabel: 'Reset filters',
                      onPress: () => setActiveGroup('all'),
                    }
                  : undefined
              }
              button={{
                variant: 'primary',
                enableHaptics: true,
                label: isFilterVisible ? 'Hide filter' : 'Filter',
                iconStart: <IconFilter />,
                onPress: () => setIsFilterVisible((current) => !current),
              }}
            />

            <View
              style={[
                styles.webContentShell,
                getResponsiveContentContainerStyle(responsive, {
                  includeWidth: false,
                  includeTopPadding: false,
                }),
              ]}
            >
              <View style={[styles.webContent, { gap: Size.space['400'] }]}>
                <View style={styles.webTitleFilterStack}>
                  {isFilterVisible ? (
                    <View style={styles.webFilterShell}>
                      <View style={[styles.webFilterContent]}>
                        <HomeRecommendationFilter
                          allRecommendations={allScored}
                          activeGroup={activeGroup}
                          onGroupChange={setActiveGroup}
                          loading={scoresLoading}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
                <View
                  testID='web-map-layout'
                  style={[
                    styles.layout,
                    getResponsiveGapStyle(responsive),
                    isPhoneBreakpoint && styles.layoutStacked,
                  ]}
                >
                  <View
                    testID='web-map-section'
                    style={[
                      styles.mapSection,
                      isPhoneBreakpoint && styles.mapSectionStacked,
                    ]}
                  >
                    <LocalMapSection
                      heatmapTileUrl={heatmapTileUrl}
                      onBoundsChange={handleBoundsChange}
                    />
                    <WeatherAttribution />
                  </View>

                  <ActiveNearYouSection
                    recommendations={recommendations}
                    allRecommendations={allScored}
                    activeGroup={activeGroup}
                    loading={scoresLoading}
                    style={[
                      styles.sidebar,
                      isPhoneBreakpoint && styles.sidebarStacked,
                    ]}
                  />
                </View>
              </View>
            </View>
          </PageScrollContainer>
        </View>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  screenWeb: {
    width: '100%',
  },
  webContent: {
    width: '100%',
    alignSelf: 'center',
  },
  webContentShell: {
    width: '100%',
    alignItems: 'center',
    marginTop: Size.space['400'],
  },
  webTitleFilterStack: {
    width: '100%',
    gap: Size.space['200'],
  },
  webFilterShell: {
    width: '100%',
    alignItems: 'center',
  },
  webFilterContent: {
    width: '100%',
    alignSelf: 'center',
  },
  layout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  layoutStacked: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  mapSection: {
    flex: 1,
    minWidth: 240,
    gap: Size.space['100'],
  },
  mapSectionStacked: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: 0,
    width: '100%',
  },
  sidebar: {
    flex: 1,
    flexBasis: SIDEBAR_WIDTH,
    minWidth: 240,
    maxWidth: 480,
  },
  sidebarStacked: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    maxWidth: '100%',
    width: '100%',
  },
});
