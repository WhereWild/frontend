// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { GisEditorScreen } from '@/components/gisEditor/GisEditorScreen';

// Web-only: parses/renders GeoTIFFs entirely in the browser. Native builds
// are being retired, so bounce them home.
export default function GisEditorRoute() {
  if (Platform.OS !== 'web') {
    return <Redirect href='/' />;
  }
  return <GisEditorScreen />;
}
