import { Colors, Shadows } from '@/constants/theme';
import { ActiveNearYouSection, HomeRecommendationFilter } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { useNativeHomeTabs } from '@/context/NativeHomeTabsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebHomeDashboard } from '../components/sections/WebHomeDashboard';

function ExploreScreenContent({
  activeGroup,
  allScored,
  isFilterVisible,
  recommendations,
  scoresLoading,
  setActiveGroup,
}: {
  activeGroup: string;
  allScored: ReturnType<typeof useNativeHomeTabs>['allScored'];
  isFilterVisible: boolean;
  recommendations: ReturnType<typeof useNativeHomeTabs>['recommendations'];
  scoresLoading: boolean;
  setActiveGroup: ReturnType<typeof useNativeHomeTabs>['setActiveGroup'];
}) {
  const responsive = useResponsive();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [isListScrolled, setIsListScrolled] = React.useState(false);
  const horizontalInsetStyle = {
    paddingHorizontal: responsive.marginHorizontal,
  };

  return (
    <PageSurface>
      <View style={styles.screen}>
        <View
          testID='native-explore-content'
          style={styles.nativeExploreContent}
        >
          <View
            collapsable={false}
            testID='explore-filter-slot'
            accessibilityElementsHidden={!isFilterVisible}
            importantForAccessibility={
              isFilterVisible ? 'auto' : 'no-hide-descendants'
            }
            style={[
              styles.filterSlot,
              isFilterVisible && { paddingTop: responsive.gap },
              !isFilterVisible && styles.hiddenSlot,
            ]}
          >
            <View
              testID='explore-filter-surface'
              style={[
                styles.filterSurface,
                { backgroundColor: palette.background.default.default },
                isFilterVisible && { paddingBottom: responsive.gap },
              ]}
            >
              <View
                testID='explore-filter-shadow-seam'
                pointerEvents='none'
                style={[
                  styles.filterShadowSeam,
                  { backgroundColor: palette.background.default.default },
                  isFilterVisible &&
                    isListScrolled &&
                    Shadows.dropShadow200.style,
                ]}
              />
              <View style={horizontalInsetStyle}>
                <HomeRecommendationFilter
                  allRecommendations={allScored}
                  activeGroup={activeGroup}
                  onGroupChange={setActiveGroup}
                  loading={scoresLoading}
                />
              </View>
            </View>
          </View>
          <ActiveNearYouSection
            recommendations={recommendations}
            allRecommendations={allScored}
            activeGroup={activeGroup}
            loading={scoresLoading}
            showHeading={false}
            style={[styles.nativeContent, horizontalInsetStyle]}
            nativeFirstItemTopMargin={isFilterVisible ? 0 : responsive.gap}
            onNativeScrolledChange={setIsListScrolled}
          />
        </View>
      </View>
    </PageSurface>
  );
}

function NativeExploreScreen() {
  const state = useNativeHomeTabs();
  return <ExploreScreenContent {...state} />;
}

export default function HomeScreen() {
  if (Platform.OS === 'web') {
    return <WebHomeDashboard />;
  }

  return <NativeExploreScreen />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  nativeExploreContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  nativeContent: {
    flex: 1,
    minHeight: 0,
  },
  filterSlot: {
    width: '100%',
  },
  filterSurface: {
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
  filterShadowSeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
  },
  hiddenSlot: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
});
