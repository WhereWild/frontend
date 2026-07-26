// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { useResponsive } from '@/hooks/useResponsive';
import { Platform } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

export default function HelpScreen() {
  const responsive = useResponsive();
  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Help'
          description='Learn how to search species, interpret maps, and use WhereWild effectively.'
          path='/help'
        />
      ) : null}
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: true,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? <PageTitle title='Help' /> : null}
          <ThemedText variant='heading'>{'Help'}</ThemedText>
          <ThemedText variant='body'>{'TBD'}</ThemedText>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}
