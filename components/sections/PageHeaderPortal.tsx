import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import type { PageHeaderProps } from './PageHeader';
import { PageHeader } from './PageHeader';

export type PageHeaderConfig = Partial<PageHeaderProps>;

type ConfigEntry = {
  config: PageHeaderConfig;
  pathname: string;
};

type ConfigMap = Map<string, ConfigEntry>;

type PageHeaderPortalContextValue = {
  activeConfig: PageHeaderConfig;
  setConfig: (id: string, config: PageHeaderConfig, pathname: string) => void;
  removeConfig: (id: string) => void;
};

const PageHeaderPortalContext = React.createContext<PageHeaderPortalContextValue | undefined>(
  undefined,
);

export function PageHeaderPortalProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = React.useState<ConfigMap>(() => new Map());
  const activePathname = usePathname();

  const setConfig = React.useCallback((id: string, config: PageHeaderConfig, pathname: string) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      next.set(id, { config, pathname });
      return next;
    });
  }, []);

  const removeConfig = React.useCallback((id: string) => {
    setConfigs((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const activeConfig = React.useMemo(() => {
    const matchingEntries = Array.from(configs.values()).filter(
      (entry) => entry.pathname === activePathname,
    );
    return matchingEntries.at(-1)?.config ?? {};
  }, [activePathname, configs]);

  const value = React.useMemo(
    () => ({
      activeConfig,
      setConfig,
      removeConfig,
    }),
    [activeConfig, setConfig, removeConfig],
  );

  return (
    <PageHeaderPortalContext.Provider value={value}>
      {children}
    </PageHeaderPortalContext.Provider>
  );
}

function usePageHeaderPortalContext() {
  const context = React.useContext(PageHeaderPortalContext);
  if (!context) {
    throw new Error('PageHeader hooks must be used within PageHeaderPortalProvider');
  }
  return context;
}

export function usePageHeaderConfig(config: PageHeaderConfig) {
  const { setConfig, removeConfig } = usePageHeaderPortalContext();
  const router = useRouter();
  const pathname = usePathname();
  const ownerPathnameRef = React.useRef(pathname);
  const goBack = React.useCallback(() => {
    router.back();
  }, [router]);
  const isHome = pathname === '/';
  const derivedShowBackButton = config.showBackButton ?? (router.canGoBack() && !isHome);
  const derivedOnBackPress = config.onBackPress ?? (derivedShowBackButton ? goBack : undefined);
  const resolvedConfig = React.useMemo(() => {
    if (
      config.showBackButton === derivedShowBackButton &&
      config.onBackPress === derivedOnBackPress
    ) {
      return config;
    }
    return {
      ...config,
      showBackButton: derivedShowBackButton,
      onBackPress: derivedOnBackPress,
    };
  }, [config, derivedOnBackPress, derivedShowBackButton]);
  const id = React.useId();

  React.useEffect(() => {
    setConfig(id, resolvedConfig, ownerPathnameRef.current);
  }, [id, resolvedConfig, setConfig]);

  React.useEffect(() => () => removeConfig(id), [id, removeConfig]);
}

export function useActivePageHeaderConfig(): PageHeaderConfig {
  const { activeConfig } = usePageHeaderPortalContext();
  return activeConfig;
}

export type PageHeaderPortalProps = Partial<PageHeaderProps>;

export function PageHeaderPortal(props: PageHeaderPortalProps = {}) {
  const activeConfig = useActivePageHeaderConfig();
  return <PageHeader {...props} {...activeConfig} />;
}
