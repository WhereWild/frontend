import {
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { Platform, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const responsive = useResponsive();

  return (
    <PageSurface>
      <PageScrollContainer
        contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
          includeHorizontalPadding: false,
          includeBottomPadding: true,
          includeGap: true,
        })}
        bounces={false}
      >
        {Platform.OS === 'web' ? <PageTitle title='Home' /> : null}
        <View
          style={[
            styles.contentShell,
            getResponsiveContentContainerStyle(responsive, {
              includeWidth: false,
              includeTopPadding: false,
            }),
          ]}
        >
          <View style={[styles.content, { maxWidth: responsive.textWidth }]}>
            <ThemedText variant='body'>
              {'Use '}
              <ThemedText variant='bodyEmphasis'>{'Search '}</ThemedText>
              {'in the navigation bar to find and explore species. Visit the '}
              <ThemedText variant='bodyEmphasis'>{'About '}</ThemedText>
              {'page to learn more about WhereWild.'}
            </ThemedText>
          </View>
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
});
