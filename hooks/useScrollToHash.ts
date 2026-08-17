// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';
import { scrollToElementId } from '@/utils/anchors';

/** On web, once `deps` settle (e.g. content/sections have rendered), scrolls
 * to the section named by an incoming URL hash — e.g. a link from another
 * page to `/guides/variables#terrain`. Matches case-insensitively since
 * generated slugs are always lowercase but a shared/typed link's hash may
 * not be. No-op on native, where URL fragments don't exist.
 *
 * This is a backstop for client-side navigation (soft nav between routes,
 * where the browser never runs its own `#hash` handling). On a hard
 * reload/address-bar navigation, the browser lands on the anchor natively
 * before this even runs — see anchorScrollMarginStyle for why that native
 * path is accounted for by CSS, not by this effect's timing. */
export function useScrollToHash(deps: React.DependencyList) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const hash = window.location?.hash;
    if (hash) {
      scrollToElementId(hash.slice(1).toLowerCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
