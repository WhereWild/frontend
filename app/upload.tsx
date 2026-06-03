// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';
import { UploadScreen } from '@/components/upload/UploadScreen';
import { WebMetadata } from '@/utils/webMetadata';

export default function Upload() {
  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Upload'
          description='Upload your own coordinate data to analyze it with WhereWild.'
          path='/upload'
        />
      ) : null}
      <UploadScreen />
    </>
  );
}
