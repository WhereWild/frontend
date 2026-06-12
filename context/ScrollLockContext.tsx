// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';

type ScrollLockContextValue = {
  lockScroll: () => void;
  unlockScroll: () => void;
};

const ScrollLockContext = React.createContext<ScrollLockContextValue>({
  lockScroll: () => {},
  unlockScroll: () => {},
});

export function useScrollLock() {
  return React.useContext(ScrollLockContext);
}

export { ScrollLockContext };
