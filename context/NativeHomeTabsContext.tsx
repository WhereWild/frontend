import { usePathname } from 'expo-router';
import { useHomeDashboardState } from '@/hooks/useHomeDashboardState';
import React from 'react';

const NATIVE_REMOTE_HYDRATION_DELAY_MS = 1500;

type NativeHomeTabsContextValue = ReturnType<typeof useHomeDashboardState> & {
  isFilterVisible: boolean;
  toggleFilterVisibility: () => void;
};

const NativeHomeTabsContext =
  React.createContext<NativeHomeTabsContextValue | null>(null);

export function NativeHomeTabsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomeTabsRoute = pathname === '/' || pathname === '/map';
  const homeDashboardState = useHomeDashboardState(undefined, {
    hydrateRemoteOnMount: isHomeTabsRoute,
    remoteHydrationDelayMs: isHomeTabsRoute
      ? NATIVE_REMOTE_HYDRATION_DELAY_MS
      : 0,
  });
  const [isFilterVisible, setIsFilterVisible] = React.useState(
    homeDashboardState.hasActiveFilter,
  );

  React.useEffect(() => {
    if (homeDashboardState.hasActiveFilter) {
      setIsFilterVisible(true);
    }
  }, [homeDashboardState.hasActiveFilter]);

  const toggleFilterVisibility = React.useCallback(() => {
    setIsFilterVisible((currentValue) => !currentValue);
  }, []);
  const value = React.useMemo(
    () => ({
      ...homeDashboardState,
      isFilterVisible,
      toggleFilterVisibility,
    }),
    [homeDashboardState, isFilterVisible, toggleFilterVisibility],
  );

  return (
    <NativeHomeTabsContext.Provider value={value}>
      {children}
    </NativeHomeTabsContext.Provider>
  );
}

export function useNativeHomeTabs() {
  const context = React.useContext(NativeHomeTabsContext);

  if (!context) {
    throw new Error(
      'useNativeHomeTabs must be used within NativeHomeTabsProvider',
    );
  }

  return context;
}
