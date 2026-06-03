// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';

type LayoutChromeContextValue = {
  webHeaderHeight: number;
  setWebHeaderHeight: (height: number) => void;
};

const NOOP = (_height: number) => {};

const LayoutChromeContext = React.createContext<LayoutChromeContextValue>({
  webHeaderHeight: 0,
  setWebHeaderHeight: NOOP,
});

export function LayoutChromeProvider({ children }: { children: React.ReactNode }) {
  const [webHeaderHeight, setWebHeaderHeight] = React.useState(0);

  const value = React.useMemo(
    () => ({ webHeaderHeight, setWebHeaderHeight }),
    [webHeaderHeight],
  );

  return (
    <LayoutChromeContext.Provider value={value}>
      {children}
    </LayoutChromeContext.Provider>
  );
}

export function useLayoutChrome() {
  return React.useContext(LayoutChromeContext);
}
