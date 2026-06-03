// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ViewStyle } from 'react-native';

export const getInteractiveCursorStyle = (disabled = false): ViewStyle => ({
  cursor: disabled ? 'auto' : 'pointer',
});
